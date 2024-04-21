package e2e

import (
	"block-feed/src/libs/services/loadbalancing"
	"block-feed/src/libs/services/processing"
	"block-feed/tests/testutils"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/onflow/flow-go-sdk/access/grpc"
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
//  8. Then finally, it tests that block data collection and block storage are working properly
//
// # This test is run against a live network for simplicity - in the future these test cases will be run against a local devnet
func TestBasic(t *testing.T) {
	// Defines helper constants
	const (
		FLOW_TESTNET_CHAIN_ID = "flow-testnet"
		FLOW_TESTNET_URL      = grpc.TestnetHost

		WEBHOOK_CONSUMER_NAME      = "webhook-consumer"
		WEBHOOK_CONSUMER_POOL_SIZE = 3

		WEBHOOK_LB_CONSUMER_NAME                = "webhook-lb-consumer"
		WEBHOOK_LB_POOL_SIZE                    = 3
		WEBHOOK_LB_LOCK_RETRY_ATTEMPTS          = 10
		WEBHOOK_LB_LOCK_EXP_BACKOFF_INIT_MS     = 1000
		WEBHOOK_LB_LOCK_EXP_BACKOFF_MAX_RAND_MS = 1000

		WEBHOOK_ACTIVATION_CONSUMER_NAME = "webhook-activation-consumer"
		WEBHOOK_ACTIVATION_POOL_SIZE     = 3

		WEBHOOK_MAX_BLOCKS  = 1
		WEBHOOK_MAX_RETRIES = 3
		WEBHOOK_TIMEOUT_MS  = 5000

		TEST_NUM_WEBHOOK_DUPS = 50
		TEST_DURATION_MS      = 15000
	)

	// Defines helper variables
	var (
		ctx    = context.Background()
		reqLog = []testutils.RequestLog{}
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

	// Creates an error group so that we can create all containers in parallel
	containerErrGrp := new(errgroup.Group)
	var cLoadBalancerRedis *testutils.ContainerWithConnectionInfo
	var cBlockPollerRedis *testutils.ContainerWithConnectionInfo
	var cWebhookRedis *testutils.ContainerWithConnectionInfo
	var cTimescaleDB *testutils.ContainerWithConnectionInfo
	var cMySql *testutils.ContainerWithConnectionInfo

	// Starts a mysql container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewMySqlContainer(ctx, t)
		if err != nil {
			return err
		} else {
			cMySql = container
		}
		return nil
	})

	// Starts a block store container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewTimescaleDBContainer(ctx, t)
		if err != nil {
			return err
		} else {
			cTimescaleDB = container
		}
		return nil
	})

	// Starts a redis container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewRedisContainer(ctx, t, testutils.RedisDefaultCmd())
		if err != nil {
			return err
		} else {
			cLoadBalancerRedis = container
		}
		return nil
	})

	// Starts a redis container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewRedisContainer(ctx, t, testutils.RedisDefaultCmd())
		if err != nil {
			return err
		} else {
			cBlockPollerRedis = container
		}
		return nil
	})

	// Starts a redis container
	containerErrGrp.Go(func() error {
		container, err := testutils.NewRedisContainer(ctx, t, testutils.RedisDefaultCmd())
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

	// Creates a flow block streamer service
	flowBlockStreamer, err := testutils.NewFlowBlockStreamer(t, ctx,
		string(FLOW_TESTNET_CHAIN_ID),
		FLOW_TESTNET_URL,
		cBlockPollerRedis.Conn.Url,
		testutils.PostgresUrl(*cTimescaleDB.Conn,
			testutils.TIMESCALEDB_BLOCKSTORE_USER_UNAME,
			testutils.TIMESCALEDB_BLOCKSTORE_USER_PWORD,
		),
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a webhook flusher service
	webhookFlusher, err := testutils.NewWebhookFlusher(t,
		cWebhookRedis.Conn.Url,
		cBlockPollerRedis.Conn.Url,
		processing.WebhookFlusherOpts{
			ChannelName: string(FLOW_TESTNET_CHAIN_ID),
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a webhook consumer service
	webhookConsumer, err := testutils.NewWebhookConsumer(t, ctx,
		cWebhookRedis.Conn.Url,
		backendUserMySqlUrl,
		testutils.PostgresUrl(*cTimescaleDB.Conn,
			testutils.TIMESCALEDB_BLOCKSTORE_USER_UNAME,
			testutils.TIMESCALEDB_BLOCKSTORE_USER_PWORD,
		),
		&processing.WebhookConsumerOpts{
			ConsumerName: WEBHOOK_CONSUMER_NAME,
			Concurrency:  WEBHOOK_CONSUMER_POOL_SIZE,
		})
	if err != nil {
		t.Fatal(err)
	}

	// Creates a webhook load balancer consumer service
	webhookLoadBalancerConsumer, err := testutils.NewWebhookLoadBalancerConsumer(t,
		cLoadBalancerRedis.Conn.Url,
		backendUserMySqlUrl,
		&loadbalancing.WebhookLoadBalancerOpts{
			ConsumerName:            WEBHOOK_LB_CONSUMER_NAME,
			Concurrency:             WEBHOOK_LB_POOL_SIZE,
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
		&processing.WebhookActivatorOpts{
			ConsumerName: WEBHOOK_ACTIVATION_CONSUMER_NAME,
			Concurrency:  WEBHOOK_ACTIVATION_POOL_SIZE,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	// Adds a webhook to the webhook load balancing stream
	if err := testutils.LoadBalanceWebhook(ctx, t,
		string(FLOW_TESTNET_CHAIN_ID),
		FLOW_TESTNET_URL,
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
	eg.Go(func() error { return flowBlockStreamer.Run(timeoutCtx) })
	eg.Go(func() error { return webhookFlusher.Run(timeoutCtx) })
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
