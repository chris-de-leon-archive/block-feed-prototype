package e2e

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/processors"
	"block-relay/src/libs/services"
	"block-relay/tests/testutils"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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
func TestBlockRelayPerformance(t *testing.T) {
	// Defines helper constants
	const (
		CHAIN_URL = "access.devnet.nodes.onflow.org:9000"
		CHAIN_ID  = blockchains.FLOW_TESTNET

		BLOCK_POLLER_NAME                   = "test-block-poller"
		BLOCK_POLLER_MAX_IN_FLIGHT_REQUESTS = 3
		BLOCK_POLLER_BLOCK_TIMEOUT_MS       = 60000
		BLOCK_POLLER_BATCH_SIZE             = 10
		BLOCK_POLLER_POLL_MS                = 100

		BLOCK_FLUSHER_BLOCK_TIMEOUT_MS = 60000

		WEBHOOK_CONSUMER_NAME             = "webhook-consumer"
		WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS = 60000
		WEBHOOK_CONSUMER_POOL_SIZE        = 3
		WEBHOOK_CONSUMER_REPLICAS         = 3

		BLOCK_CACHE_CONSUMER_NAME    = string(CHAIN_ID) + "-block-cache-consumer"
		BLOCK_CACHE_BLOCK_TIMEOUT_MS = 60000
		BLOCK_CACHE_POOL_SIZE        = 1

		REDIS_VERSION = "7.2.1-alpine3.18"
		MONGO_VERSION = "7.0.5"
		MYSQL_VERSION = "8.3.0"

		WEBHOOK_MAX_BLOCKS  = 1
		WEBHOOK_MAX_RETRIES = 3
		WEBHOOK_TIMEOUT_MS  = 5000

		TEST_DURATION_MS  = 15000
		TEST_NUM_WEBHOOKS = 100
	)

	// Defines helper variables
	var (
		ctx            = context.Background()
		counter        = 0
		blockchainOpts = &blockchains.BlockchainOpts{
			ChainUrl: CHAIN_URL,
			ChainID:  CHAIN_ID,
		}
	)

	// Creates a chain resolver
	resolver := testutils.NewChainResolver()
	t.Cleanup(func() { resolver.Close(func(err error) { t.Logf("error: %v\n", err) }) })

	// Gets the blockchain client
	chain, err := resolver.ResolveChain(blockchainOpts)
	if err != nil {
		t.Fatal(err)
	}

	// Creates an error group so that we can create all containers in parallel
	containerErrGrp := new(errgroup.Group)
	var cBlockPollerRedis *testutils.ContainerWithConnectionInfo
	var cWebhookRedis *testutils.ContainerWithConnectionInfo
	var cMongoDB *testutils.ContainerWithConnectionInfo
	var cMySql *testutils.ContainerWithConnectionInfo

	// Starts a mysql container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewMySqlContainer(ctx, t, MYSQL_VERSION)
		if err != nil {
			return err
		} else {
			cMySql = container
		}
		return nil
	})

	// Starts a mongo container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewMongoContainer(ctx, t, MONGO_VERSION, false)
		if err != nil {
			return err
		} else {
			cMongoDB = container
		}
		return nil
	})

	// Starts a redis container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewRedisContainer(ctx, t, REDIS_VERSION, testutils.RedisDefaultCmd())
		if err != nil {
			return err
		} else {
			cBlockPollerRedis = container
		}
		return nil
	})

	// Starts a redis container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewRedisContainer(ctx, t, REDIS_VERSION, testutils.RedisDefaultCmd())
		if err != nil {
			return err
		} else {
			cWebhookRedis = container
		}
		return nil
	})

	// Waits for all the containers to be created
	if err := containerErrGrp.Wait(); err != nil {
		t.Fatal(err)
	}

	// Creates a block poller service
	blockPoller, err := testutils.NewBlockPoller(t,
		cBlockPollerRedis.Conn.Url,
		chain,
		services.BlockPollerOpts{
			MaxInFlightRequests: BLOCK_POLLER_MAX_IN_FLIGHT_REQUESTS,
			BlockTimeoutMs:      BLOCK_POLLER_BLOCK_TIMEOUT_MS,
			BatchSize:           BLOCK_POLLER_BATCH_SIZE,
			PollMs:              BLOCK_POLLER_POLL_MS,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a block cache consumer service
	blockCacheConsumer, err := testutils.NewBlockCacheConsumer(t, ctx,
		cBlockPollerRedis.Conn.Url,
		testutils.MongoUrl(*cMongoDB.Conn,
			testutils.MONGO_READWRITE_UNAME,
			testutils.MONGO_READWRITE_PWORD,
		),
		services.StreamConsumerOpts{
			ConsumerName:     BLOCK_CACHE_CONSUMER_NAME,
			ConsumerPoolSize: BLOCK_CACHE_POOL_SIZE,
			BlockTimeoutMs:   BLOCK_CACHE_BLOCK_TIMEOUT_MS,
		},
		processors.CachingProcessorOpts{
			ChainID: string(blockchainOpts.ChainID),
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a block flusher service
	blockFlusher, err := testutils.NewBlockFlusher(t,
		cWebhookRedis.Conn.Url,
		cBlockPollerRedis.Conn.Url,
		services.BlockFlusherOpts{
			BlockTimeoutMs: BLOCK_FLUSHER_BLOCK_TIMEOUT_MS,
		})
	if err != nil {
		t.Fatal(err)
	}

	// Creates multiple webhook consumer services
	webhookConsumers := make([]*services.StreamConsumer, WEBHOOK_CONSUMER_REPLICAS)
	for i := 0; i < WEBHOOK_CONSUMER_REPLICAS; i++ {
		webhookConsumer, err := testutils.NewWebhookConsumer(t, ctx,
			cWebhookRedis.Conn.Url,
			testutils.MySqlUrl(*cMySql.Conn,
				testutils.MYSQL_BLOCK_RELAY_UNAME,
				testutils.MYSQL_BLOCK_RELAY_PWORD,
			),
			testutils.MongoUrl(*cMongoDB.Conn,
				testutils.MONGO_READONLY_UNAME,
				testutils.MONGO_READONLY_PWORD,
			),
			services.StreamConsumerOpts{
				ConsumerName:     fmt.Sprintf("%s-%d", WEBHOOK_CONSUMER_NAME, i),
				ConsumerPoolSize: WEBHOOK_CONSUMER_POOL_SIZE,
				BlockTimeoutMs:   WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS,
			},
		)
		if err != nil {
			t.Fatal(err)
		} else {
			webhookConsumers[i] = webhookConsumer
		}
	}

	// Creates a webhook server
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) { counter += 1 }))
	t.Cleanup(func() { server.Close() })

	// Creates several webhook servers
	serverURLs := make([]string, TEST_NUM_WEBHOOKS)
	for i := 0; i < TEST_NUM_WEBHOOKS; i++ {
		serverURLs[i] = server.URL
	}

	// Creates and activates the webhooks
	if err := testutils.SetupWebhooks(ctx, t,
		chain,
		cWebhookRedis.Conn.Url,
		cMySql.Conn.Url,
		serverURLs,
		WEBHOOK_MAX_BLOCKS,
		WEBHOOK_MAX_RETRIES,
		WEBHOOK_TIMEOUT_MS,
	); err != nil {
		t.Fatal(err)
	}

	// Creates a context that will be canceled at a later time
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(TEST_DURATION_MS)*time.Millisecond)
	defer cancel()

	// Runs all services in the background
	eg := new(errgroup.Group)
	eg.Go(func() error { return blockPoller.Run(timeoutCtx) })
	eg.Go(func() error { return blockCacheConsumer.Run(timeoutCtx) })
	eg.Go(func() error { return blockFlusher.Run(timeoutCtx) })
	for _, consumer := range webhookConsumers {
		webhookConsumer := consumer
		eg.Go(func() error { return webhookConsumer.Run(timeoutCtx) })
	}

	// Waits for the timeout (processing should occur in the background while we wait)
	// Fails the test if an unexpected error occurs
	if err := eg.Wait(); err != nil && !errors.Is(err, context.DeadlineExceeded) && !strings.Contains(err.Error(), "i/o timeout") {
		t.Fatal(err)
	}

	// Checks that the correct number of http calls was made
	t.Logf("webhook server received %d request(s)", counter)
}
