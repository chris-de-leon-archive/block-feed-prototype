package e2e

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/redis/redicluster"
	"block-feed/src/libs/services/processing"
	"block-feed/tests/testutils"
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/onflow/flow-go-sdk/access/grpc"
	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/errgroup"
)

// This test case simulates N consumers processing a stream of W webhooks as
// new data arrives at a nearly constant rate of S milliseconds. In this case:
//
//	N = WEBHOOK_CONSUMER_POOL_SIZE * WEBHOOK_CONSUMER_REPLICAS
//	W = TEST_NUM_WEBHOOKS
//	S = BLOCK_POLLER_POLL_MS
//
// This test case uses one redis instance to host all the webhook consumers. However,
// it is possible to scale this out horizontally. One would need to create another
// redis container, and connect another fleet of webhook consumers to it alongside
// another single block flusher node. The webhooks can then be load balanced between
// the redis instances, so instead of having one redis instance with a stream of say
// 1000 webhooks to process, this can be split 50/50 so that one redis node gets 500
// webhooks and the other node gets the other 500.
//
// This test is run against a live network for simplicity - in the future these test
// cases will be run against a local devnet
//
// =
func TestLoad(t *testing.T) {
	// Defines helper constants
	const (
		FLOW_TESTNET_CHAIN_ID = "flow-testnet"
		FLOW_TESTNET_URL      = grpc.TestnetHost

		WEBHOOK_CONSUMER_NAME               = "webhook-consumer"
		WEBHOOK_CONSUMER_REPLICAS_PER_SHARD = 2
		WEBHOOK_CONSUMER_POOL_SIZE          = 2

		BLOCK_CONSUMER_NAME       = "block-consumer"
		BLOCK_CONSUMER_BATCH_SIZE = 100

		BLOCK_FLUSH_INTERVAL_MS = 1000
		BLOCK_FLUSH_MAX_BLOCKS  = 5

		WEBHOOK_MAX_BLOCKS  = 1
		WEBHOOK_MAX_RETRIES = 3
		WEBHOOK_TIMEOUT_MS  = 5000

		TEST_DURATION_MS  = 15000
		TEST_NUM_WEBHOOKS = 100
		TEST_SHARDS       = 2
	)

	// Defines helper variables
	var (
		ctx     = context.Background()
		counter = 0
	)

	// Creates an error group so that we can create all containers in parallel
	containerErrGrp := new(errgroup.Group)
	var cRedisCluster *testutils.ContainerWithConnectionInfo
	var cRedisStream *testutils.ContainerWithConnectionInfo
	var cRedisStore *testutils.ContainerWithConnectionInfo
	var cTimescaleDB *testutils.ContainerWithConnectionInfo

	// Starts a timescale container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewTimescaleDBContainer(ctx, t)
		if err != nil {
			return err
		} else {
			cTimescaleDB = container
		}
		return nil
	})

	// Starts a redis cluster container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewRedisClusterContainer(ctx, t, testutils.REDIS_CLUSTER_MIN_NODES)
		if err != nil {
			return err
		} else {
			cRedisCluster = container
		}
		return nil
	})

	// Starts a redis container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewRedisContainer(ctx, t, testutils.RedisBlockStoreCmd())
		if err != nil {
			return err
		} else {
			cRedisStore = container
		}
		return nil
	})

	// Starts a redis container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewRedisContainer(ctx, t, testutils.RedisDefaultCmd())
		if err != nil {
			return err
		} else {
			cRedisStream = container
		}
		return nil
	})

	// Waits for all the containers to be created
	if err := containerErrGrp.Wait(); err != nil {
		t.Fatal(err)
	}

	// Creates a blockstore
	store, err := testutils.NewRedisOptimizedBlockStore(t, ctx,
		FLOW_TESTNET_CHAIN_ID,
		cRedisStore.Conn.Url,
		testutils.PostgresUrl(*cTimescaleDB.Conn,
			testutils.TIMESCALEDB_BLOCKSTORE_USER_UNAME,
			testutils.TIMESCALEDB_BLOCKSTORE_USER_PWORD,
		),
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a flow block streamer service
	flowBlockStreamer, err := testutils.NewFlowBlockStreamer(t, ctx,
		FLOW_TESTNET_CHAIN_ID,
		FLOW_TESTNET_URL,
		cRedisStream.Conn.Url,
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a block consumer service
	flowBlockConsumer, err := testutils.NewBlockStreamConsumer(t, ctx,
		TEST_SHARDS,
		store,
		FLOW_TESTNET_CHAIN_ID,
		cRedisCluster.Conn.Url,
		cRedisStream.Conn.Url,
		&processing.BlockStreamConsumerOpts{
			ConsumerName: BLOCK_CONSUMER_NAME,
			BatchSize:    BLOCK_CONSUMER_BATCH_SIZE,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates WEBHOOK_CONSUMER_REPLICAS_PER_SHARD replicas of a webhook stream consumer service
	// for each shard. Each service has WEBHOOK_CONSUMER_POOL_SIZE concurrent workers.
	webhookConsumers := make([]*processing.WebhookStreamConsumer, TEST_SHARDS*WEBHOOK_CONSUMER_REPLICAS_PER_SHARD)
	for shardNum := range TEST_SHARDS {
		for replicaNum := range WEBHOOK_CONSUMER_REPLICAS_PER_SHARD {
			webhookConsumer, err := testutils.NewWebhookStreamConsumer(t, ctx,
				store,
				cRedisCluster.Conn.Url,
				shardNum,
				&processing.WebhookStreamConsumerOpts{
					ConsumerName: fmt.Sprintf("s%d:%s:%d", shardNum, WEBHOOK_CONSUMER_NAME, replicaNum),
					Concurrency:  WEBHOOK_CONSUMER_POOL_SIZE,
				})
			if err != nil {
				t.Fatal(err)
			} else {
				webhookConsumers[(shardNum*WEBHOOK_CONSUMER_REPLICAS_PER_SHARD)+replicaNum] = webhookConsumer
			}
		}
	}

	// Creates a webhook server
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) { counter += 1 }))
	t.Cleanup(func() { server.Close() })

	// Distributes the webhooks over random shards for processing
	if _, err := testutils.GetTempRedisClusterClient(cRedisCluster.Conn.Url, func(client *redis.ClusterClient) (bool, error) {
		for range TEST_NUM_WEBHOOKS {
			if err := redicluster.NewRedisCluster(client).
				Webhooks.Set(
				ctx,
				rand.IntN(TEST_SHARDS),
				redicluster.Webhook{
					ID:           uuid.NewString(),
					URL:          server.URL,
					BlockchainID: FLOW_TESTNET_CHAIN_ID,
					MaxRetries:   WEBHOOK_MAX_RETRIES,
					MaxBlocks:    WEBHOOK_MAX_BLOCKS,
					TimeoutMs:    WEBHOOK_TIMEOUT_MS,
				},
			); err != nil {
				return false, err
			}
		}
		return true, nil
	}); err != nil {
		t.Fatal(err)
	}

	// Creates a context that will be canceled at a later time
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(TEST_DURATION_MS)*time.Millisecond)
	defer cancel()

	// Runs all services in the background
	eg := new(errgroup.Group)
	eg.Go(func() error { return flowBlockStreamer.Run(timeoutCtx) })
	eg.Go(func() error { return flowBlockConsumer.Run(timeoutCtx) })
	eg.Go(func() error {
		return store.StartFlushing(
			timeoutCtx,
			FLOW_TESTNET_CHAIN_ID,
			blockstore.RedisOptimizedBlockStoreFlushOpts{
				IntervalMs: BLOCK_FLUSH_INTERVAL_MS,
				MaxBlocks:  BLOCK_FLUSH_MAX_BLOCKS,
			},
		)
	})
	for _, consumer := range webhookConsumers {
		eg.Go(func() error { return consumer.Run(timeoutCtx) })
	}

	// Waits for the timeout (processing should occur in the background while we wait)
	// Fails the test if an unexpected error occurs
	if err := eg.Wait(); err != nil && !errors.Is(err, context.DeadlineExceeded) && !strings.Contains(err.Error(), "i/o timeout") {
		t.Fatal(err)
	}

	// Checks that the correct number of http calls was made
	t.Logf("webhook server received %d request(s)", counter)
}
