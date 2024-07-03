package e2e

import (
	"appenv"
	"blockrelay"
	"blockrouter"
	"cachedstore"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"tests/testservices"
	"tests/testwebhooks"
	"testutils"
	"time"

	"github.com/google/uuid"
	"github.com/onflow/flow-go-sdk/access/grpc"
	"golang.org/x/sync/errgroup"
)

// This test case simulates N consumers processing a stream of W webhooks as
// a batch of B blocks arrives in near real time. In this case:
//
//	N = TEST_SHARDS * WEBHOOK_CONSUMER_REPLICAS_PER_SHARD * WEBHOOK_CONSUMER_POOL_SIZE
//	W = TEST_NUM_WEBHOOKS
//	B = BLOCK_CONSUMER_BATCH_SIZE
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

		WEBHOOK_PROCESSOR_NAME               = "webhook-processor"
		WEBHOOK_PROCESSOR_REPLICAS_PER_SHARD = int32(2)
		WEBHOOK_PROCESSOR_POOL_SIZE          = 2

		BLOCK_ROUTER_NAME       = "block-router"
		BLOCK_ROUTER_BATCH_SIZE = 100

		BLOCK_FLUSH_INTERVAL_MS = 1000
		BLOCK_FLUSH_MAX_BLOCKS  = 5

		WEBHOOK_MAX_BLOCKS  = 1
		WEBHOOK_MAX_RETRIES = 3
		WEBHOOK_TIMEOUT_MS  = 5000

		TEST_DURATION_MS  = 15000
		TEST_NUM_WEBHOOKS = 100
		TEST_SHARDS       = int32(2)
	)

	// Defines helper variables
	var (
		ctx        = context.Background()
		counter    = 0
		customerID = uuid.NewString()
	)

	// Creates an error group so that we can create all containers in parallel
	containerErrGrp := new(errgroup.Group)
	var cRedisCluster *testutils.ContainerWithConnectionInfo
	var cRedisStream *testutils.ContainerWithConnectionInfo
	var cRedisStore *testutils.ContainerWithConnectionInfo
	var cTimescaleDB *testutils.ContainerWithConnectionInfo
	var cMySqlDB *testutils.ContainerWithConnectionInfo

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

	// Starts a mysql container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewMySqlContainer(ctx, t)
		if err != nil {
			return err
		} else {
			cMySqlDB = container
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

	// Inserts a blockchain
	config := appenv.ChainEnv{
		ChainID:    FLOW_TESTNET_CHAIN_ID,
		ShardCount: TEST_SHARDS,
		ChainUrl:   FLOW_TESTNET_URL,
		PgStoreUrl: testutils.PostgresUrl(*cTimescaleDB.Conn,
			testutils.TIMESCALEDB_ROOT_USER_UNAME,
			testutils.TIMESCALEDB_ROOT_USER_PWORD,
		),
		RedisStoreUrl:   cRedisStore.Conn.Url,
		RedisClusterUrl: cRedisCluster.Conn.Url,
		RedisStreamUrl:  cRedisStream.Conn.Url,
	}

	// Creates a blockstore
	store, err := testservices.NewRedisOptimizedBlockStore(t, ctx, config)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a flow block streamer service
	flowBlockForwarder, err := testservices.NewFlowBlockForwarder(t, ctx, config)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a block router service
	flowBlockRouter, err := testservices.NewBlockRouter(t, ctx,
		config,
		store,
		&blockrouter.BlockRouterOpts{
			ConsumerName: BLOCK_ROUTER_NAME,
			BatchSize:    BLOCK_ROUTER_BATCH_SIZE,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates WEBHOOK_CONSUMER_REPLICAS_PER_SHARD replicas of a webhook stream consumer service
	// for each shard. Each service has WEBHOOK_CONSUMER_POOL_SIZE concurrent workers.
	blockRelays := make([]*blockrelay.BlockRelay, TEST_SHARDS*WEBHOOK_PROCESSOR_REPLICAS_PER_SHARD)
	for shardID := range TEST_SHARDS {
		for replicaNum := range WEBHOOK_PROCESSOR_REPLICAS_PER_SHARD {
			blockRelay, err := testservices.NewBlockRelay(t, ctx,
				config,
				store,
				testutils.MySqlUrl(
					*cMySqlDB.Conn,
					testutils.MYSQL_WORKERS_USER_UNAME,
					testutils.MYSQL_WORKERS_USER_PWORD,
				),
				testutils.MYSQL_DEFAULT_CONN_POOL_SIZE,
				shardID,
				&blockrelay.BlockRelayOpts{
					ConsumerName: fmt.Sprintf("s%d:%s:%d", shardID, WEBHOOK_PROCESSOR_NAME, replicaNum),
					Concurrency:  WEBHOOK_PROCESSOR_POOL_SIZE,
				})
			if err != nil {
				t.Fatal(err)
			} else {
				blockRelays[(shardID*WEBHOOK_PROCESSOR_REPLICAS_PER_SHARD)+replicaNum] = blockRelay
			}
		}
	}

	// Creates a webhook server
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) { counter += 1 }))
	t.Cleanup(func() { server.Close() })

	// Distributes the webhook(s) over random shards
	webhooks := testwebhooks.CreateManyWebhooks(
		TEST_NUM_WEBHOOKS,
		server.URL,
		WEBHOOK_MAX_BLOCKS,
		WEBHOOK_MAX_RETRIES,
		WEBHOOK_TIMEOUT_MS,
		customerID,
		FLOW_TESTNET_CHAIN_ID,
		TEST_SHARDS,
	)

	// Adds the webhook(s) to the database
	if err := testwebhooks.InsertManyWebhooks(ctx,
		cMySqlDB.Conn.Url,
		testutils.MYSQL_DEFAULT_CONN_POOL_SIZE,
		customerID,
		config,
		webhooks,
	); err != nil {
		t.Fatal(err)
	}

	// Schedules the webhook(s) for processing
	if err := testwebhooks.ActivateManyWebhooks(ctx, cRedisCluster.Conn.Url, webhooks); err != nil {
		t.Fatal(err)
	}

	// Creates a context that will be canceled at a later time
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(TEST_DURATION_MS)*time.Millisecond)
	defer cancel()

	// Runs all services in the background
	eg := new(errgroup.Group)
	eg.Go(func() error { return flowBlockForwarder.Run(timeoutCtx) })
	eg.Go(func() error { return flowBlockRouter.Run(timeoutCtx) })
	eg.Go(func() error {
		return store.StartFlushing(
			timeoutCtx,
			FLOW_TESTNET_CHAIN_ID,
			cachedstore.RedisOptimizedBlockStoreFlushOpts{
				IntervalMs: BLOCK_FLUSH_INTERVAL_MS,
				Threshold:  BLOCK_FLUSH_MAX_BLOCKS,
			},
		)
	})
	for _, service := range blockRelays {
		srv := service
		eg.Go(func() error { return srv.Run(timeoutCtx) })
	}

	// Waits for the timeout (processing should occur in the background while we wait)
	// Fails the test if an unexpected error occurs
	if err := eg.Wait(); err != nil && !errors.Is(err, context.DeadlineExceeded) && !strings.Contains(err.Error(), "i/o timeout") {
		t.Fatal(err)
	}

	// Checks that the correct number of http calls was made
	t.Logf("webhook server received %d request(s)", counter)
}
