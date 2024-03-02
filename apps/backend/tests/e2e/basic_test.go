package e2e

import (
	"block-feed/src/libs/blockchains"
	"block-feed/src/libs/processors"
	"block-feed/src/libs/services"
	"block-feed/tests/testutils"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/sync/errgroup"
)

// TODO: tests to add:
//
//	job retries / failed job handling (stream consumer)
//	fault tolerance (all)
//	add timing test (i.e. what is the average time it takes for a block to be sent to a webhook once it is sealed on the chain?)

// # This test case performs the following:
//
//  1. It adds the same webhook to the load balancer stream multiple times
//
//  2. It lets multiple load balancer consumers filter out the duplicate webhooks so that only the original one remains
//
//  3. It tests what happens when multiple load balancer consumers try to claim the same webhook (only one should be able to claim it)
//
//  4. It tests that the load blanacer consumer that claimed the webhook was able to distribute it to the activation stream on a different redis node
//
//  5. It tests that the webhook activation consumers receive the webhook and move it to the pending set for processing
//
//  6. It tests that the block flusher is correctly flushing the latest block
//
//  7. It tests that multiple webhook consumers are able to deliver the block data to the webhook URL when the block flusher updates the latest block height
//
//  8. Then finally, it tests that block data collection and storage in Mongo DB are working properly
//
// # This test is run against a live network for simplicity - in the future these test cases will be run against a local devnet
func TestBasic(t *testing.T) {
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

		BLOCK_CONSUMER_NAME    = string(CHAIN_ID) + "-block-consumer"
		BLOCK_BLOCK_TIMEOUT_MS = 60000
		BLOCK_POOL_SIZE        = 1

		WEBHOOK_LB_CONSUMER_NAME                = "webhook-lb-consumer"
		WEBHOOK_LB_BLOCK_TIMEOUT_MS             = 60000
		WEBHOOK_LB_POOL_SIZE                    = 3
		WEBHOOK_LB_LOCK_RETRY_ATTEMPTS          = 10
		WEBHOOK_LB_LOCK_EXP_BACKOFF_INIT_MS     = 1000
		WEBHOOK_LB_LOCK_EXP_BACKOFF_MAX_RAND_MS = 1000

		WEBHOOK_ACTIVATION_CONSUMER_NAME    = "webhook-activation-consumer"
		WEBHOOK_ACTIVATION_BLOCK_TIMEOUT_MS = 60000
		WEBHOOK_ACTIVATION_POOL_SIZE        = 3

		REDIS_VERSION = "7.2.1-alpine3.18"
		MONGO_VERSION = "7.0.5"
		MYSQL_VERSION = "8.3.0"

		WEBHOOK_MAX_BLOCKS  = 1
		WEBHOOK_MAX_RETRIES = 3
		WEBHOOK_TIMEOUT_MS  = 5000

		TEST_NUM_WEBHOOK_DUPS = 50
		TEST_DURATION_MS      = 15000
	)

	// Defines helper variables
	var (
		ctx            = context.Background()
		reqLog         = []testutils.RequestLog{}
		blockchainOpts = &blockchains.BlockchainOpts{
			ChainUrl: CHAIN_URL,
			ChainID:  CHAIN_ID,
		}
	)

	// Starts a mock server
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, req *http.Request) {
		timestamp := time.Now().UTC().String()

		body, err := io.ReadAll(req.Body)
		if err != nil {
			t.Fatal(err)
			return
		} else {
			defer req.Body.Close()
		}

		blocks, err := testutils.JsonParse[[]string](string(body))
		if err != nil {
			t.Fatal(err)
		}

		reqLog = append(reqLog, testutils.RequestLog{
			Timestamp: timestamp,
			Blocks:    blocks,
		})
	}))
	t.Cleanup(func() { server.Close() })

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
	var cLoadBalancerRedis *testutils.ContainerWithConnectionInfo
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
		container, err := testutils.NewMongoContainer(ctx, t, MONGO_VERSION, true)
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
			cLoadBalancerRedis = container
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

	// Instead of using superuser credentials, use a role with limited permissions
	backendUserMySqlUrl := testutils.MySqlUrl(*cMySql.Conn, testutils.MYSQL_BACKEND_USER_UNAME, testutils.MYSQL_BACKEND_USER_PWORD)

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

	// Creates a block consumer service
	blockConsumer, err := testutils.NewBlockConsumer(t, ctx,
		cBlockPollerRedis.Conn.Url,
		testutils.MongoUrl(*cMongoDB.Conn,
			testutils.MONGO_READWRITE_USER_UNAME,
			testutils.MONGO_READWRITE_USER_PWORD,
		),
		services.StreamConsumerOpts{
			ConsumerName:     BLOCK_CONSUMER_NAME,
			ConsumerPoolSize: BLOCK_POOL_SIZE,
			BlockTimeoutMs:   BLOCK_BLOCK_TIMEOUT_MS,
		},
		processors.BlockProcessorOpts{
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

	// Creates a webhook consumer service
	webhookConsumer, err := testutils.NewWebhookConsumer(t, ctx,
		cWebhookRedis.Conn.Url,
		backendUserMySqlUrl,
		testutils.MongoUrl(*cMongoDB.Conn,
			testutils.MONGO_READONLY_USER_UNAME,
			testutils.MONGO_READONLY_USER_PWORD,
		),
		services.StreamConsumerOpts{
			ConsumerName:     WEBHOOK_CONSUMER_NAME,
			ConsumerPoolSize: WEBHOOK_CONSUMER_POOL_SIZE,
			BlockTimeoutMs:   WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS,
		})
	if err != nil {
		t.Fatal(err)
	}

	// Creates a webhook load balancer consumer service
	webhookLoadBalancerConsumer, err := testutils.NewWebhookLoadBalancerConsumer(t,
		cLoadBalancerRedis.Conn.Url,
		backendUserMySqlUrl,
		services.StreamConsumerOpts{
			ConsumerName:     WEBHOOK_LB_CONSUMER_NAME,
			ConsumerPoolSize: WEBHOOK_LB_POOL_SIZE,
			BlockTimeoutMs:   WEBHOOK_LB_BLOCK_TIMEOUT_MS,
		},
		processors.WebhookLoadBalancerProcessorOpts{
			LockExpBackoffInitMs:    WEBHOOK_LB_LOCK_EXP_BACKOFF_INIT_MS,
			LockRetryAttempts:       WEBHOOK_LB_LOCK_RETRY_ATTEMPTS,
			LockExpBackoffMaxRandMs: WEBHOOK_LB_LOCK_EXP_BACKOFF_MAX_RAND_MS,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a webhook activation consumer service
	webhookActivationConsumer, err := testutils.NewWebhookActivationConsumer(t,
		cWebhookRedis.Conn.Url,
		backendUserMySqlUrl,
		services.StreamConsumerOpts{
			ConsumerName:     WEBHOOK_ACTIVATION_CONSUMER_NAME,
			ConsumerPoolSize: WEBHOOK_ACTIVATION_POOL_SIZE,
			BlockTimeoutMs:   WEBHOOK_ACTIVATION_BLOCK_TIMEOUT_MS,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	// Adds a webhook to the webhook load balancing stream
	if err := testutils.LoadBalanceWebhook(ctx, t,
		chain,
		cMySql.Conn.Url,
		cLoadBalancerRedis.Conn.Url,
		server.URL,
		WEBHOOK_MAX_BLOCKS,
		WEBHOOK_MAX_RETRIES,
		WEBHOOK_TIMEOUT_MS,
		[]string{cWebhookRedis.Conn.Url},
		TEST_NUM_WEBHOOK_DUPS,
	); err != nil {
		t.Fatal(err)
	}

	// Creates a context that will be canceled at a later time
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(TEST_DURATION_MS)*time.Millisecond)
	defer cancel()

	// Runs all services in the background
	eg := new(errgroup.Group)
	eg.Go(func() error { return blockPoller.Run(timeoutCtx) })
	eg.Go(func() error { return blockConsumer.Run(timeoutCtx) })
	eg.Go(func() error { return blockFlusher.Run(timeoutCtx) })
	eg.Go(func() error { return webhookConsumer.Run(timeoutCtx) })
	eg.Go(func() error { return webhookActivationConsumer.Run(timeoutCtx) })
	eg.Go(func() error { return webhookLoadBalancerConsumer.Run(timeoutCtx) })

	// Waits for the timeout (processing should occur in the background while we wait)
	// Fails the test if an unexpected error occurs
	if err := eg.Wait(); err != nil && !errors.Is(err, context.DeadlineExceeded) && !strings.Contains(err.Error(), "i/o timeout") {
		t.Fatal(err)
	}

	// Checks that the correct number of http calls was made
	t.Logf("Total number of requests received by webhook: %d\n", len(reqLog))
	if len(reqLog) == 0 {
		t.Fatal("Webhook received no blocks\n")
	} else {
		blockCount := 0
		for _, req := range reqLog {
			t.Logf("  => Received request at %s containing %d block(s)", req.Timestamp, len(req.Blocks))
			for _, block := range req.Blocks {
				parsedBlock, err := testutils.JsonParse[map[string]any](block)
				if err != nil {
					t.Fatal(err)
				}
				blockHeight, exists := parsedBlock["height"]
				if !exists {
					t.Fatal("block has no key named \"height\"")
				}
				blockTime, exists := parsedBlock["timestamp"]
				if !exists {
					t.Fatal("block has no key named \"timestamp\"")
				}
				t.Logf("    => Received block %.0f (block timestamp = %s)\n", blockHeight, blockTime)
			}
			blockCount += len(req.Blocks)
		}
		t.Logf("Total number of blocks received by webhook: %d\n", blockCount)
	}
}
