package e2e

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/processors"
	"block-relay/src/libs/services"
	"block-relay/tests/testutils"
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

// TODO: make sure docker images are locally available using docker pull BEFORE this test file is run
// TODO: tests to add:
//
//	try to create a consumer group that already exists (stream consumer)
//	job retries / failed job handling (stream consumer)
//	adding a batch of blocks (poller)
//	individual block poller
//	individual block receiver
//	individual webhook consumer
//	individual rescheduling consumer
//	fault tolerance (all)
//	add timing test (i.e. what is the average time it takes for a block to be sent to a webhook once it is sealed on the chain?)
func TestBlockRelay(t *testing.T) {
	// Defines helper constants
	const (
		BLOCK_POLLER_NAME                   = "test-block-poller"
		BLOCK_POLLER_MAX_IN_FLIGHT_REQUESTS = 3
		BLOCK_POLLER_BATCH_SIZE             = 10
		BLOCK_POLLER_POLL_MS                = 500

		BLOCK_RECEIVER_BATCH_SIZE  = 1000
		BLOCK_RECEIVER_MAX_WAIT_MS = 10000

		WEBHOOK_CONSUMER_NAME                   = "webhook-consumer"
		WEBHOOK_CONSUMER_MAX_IN_FLIGHT_REQUESTS = 3
		WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS       = 60000
		WEBHOOK_CONSUMER_MAX_POOL_SIZE          = 3

		RESCHEDULING_CONSUMER_NAME             = "rescheduling-consumer"
		RESCHEDULING_CONSUMER_BLOCK_TIMEOUT_MS = 60000
		RESCHEDULING_CONSUMER_MAX_POOL_SIZE    = 3

		REDIS_VERSION    = "7.2.1-alpine3.18"
		POSTGRES_VERSION = "16.1-alpine3.18"

		CHAIN_URL = "access.devnet.nodes.onflow.org:9000"
		CHAIN_ID  = blockchains.FLOW_TESTNET

		BLOCK_RELAY_UNAME = "block_relay_role"
		BLOCK_RELAY_PWORD = "password"

		TEST_DURATION_MS       = 5000
		WEBHOOK_MAX_RETRIES    = 2
		WEBHOOK_TIMEOUT_MS     = 5000
		WEBHOOK_RETRY_DELAY_MS = 1000
	)

	// Defines helper variables
	var (
		ctx            = context.Background()
		reqLog         = map[string][]string{}
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

		reqLog[timestamp] = blocks
	}))
	defer server.Close()

	// Starts a postgres container
	postgresC, err := testutils.NewPostgresContainer(ctx, t, POSTGRES_VERSION)
	if err != nil {
		t.Fatal(err)
	}

	// Starts a redis cache container
	redisC, err := testutils.NewRedisContainer(ctx, t, REDIS_VERSION, testutils.RedisDefaultCmd())
	if err != nil {
		t.Fatal(err)
	}

	// Instead of using superuser credentials, use a role with limited permissions
	dbUrl := testutils.PostgresUrl(*postgresC.Conn, BLOCK_RELAY_UNAME, BLOCK_RELAY_PWORD)

	// Creates a block poller service
	blockPoller, err := testutils.NewBlockPoller(t, ctx, dbUrl, *blockchainOpts, services.BlockPollerOpts{
		Name:                BLOCK_POLLER_NAME,
		MaxInFlightRequests: BLOCK_POLLER_MAX_IN_FLIGHT_REQUESTS,
		BatchSize:           BLOCK_POLLER_BATCH_SIZE,
		PollMs:              BLOCK_POLLER_POLL_MS,
	})
	if err != nil {
		t.Fatal(err)
	}

	// Creates a block poller service
	blockReceiver, err := testutils.NewBlockReceiver(t, ctx, redisC.Conn.Url, dbUrl, services.BlockReceiverOpts{
		BatchSize: BLOCK_RECEIVER_BATCH_SIZE,
		MaxWaitMs: BLOCK_RECEIVER_MAX_WAIT_MS,
	})
	if err != nil {
		t.Fatal(err)
	}

	// Creates a webhook consumer service
	webhookConsumer, err := testutils.NewWebhookConsumer(t, ctx, redisC.Conn.Url, dbUrl,
		services.StreamConsumerOpts{
			ConsumerName:   WEBHOOK_CONSUMER_NAME,
			MaxPoolSize:    WEBHOOK_CONSUMER_MAX_POOL_SIZE,
			BlockTimeoutMs: WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS,
		},
		processors.WebhookProcessorOpts{
			MaxReschedulingRetries: WEBHOOK_CONSUMER_MAX_IN_FLIGHT_REQUESTS,
		})
	if err != nil {
		t.Fatal(err)
	}

	// Creates a rescheduling consumer service
	reschedulingConsumer, err := testutils.NewReschedulingConsumer(t, ctx, redisC.Conn.Url, dbUrl,
		services.StreamConsumerOpts{
			ConsumerName:   RESCHEDULING_CONSUMER_NAME,
			MaxPoolSize:    RESCHEDULING_CONSUMER_MAX_POOL_SIZE,
			BlockTimeoutMs: RESCHEDULING_CONSUMER_BLOCK_TIMEOUT_MS,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a context that will be canceled at a later time
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(TEST_DURATION_MS)*time.Millisecond)
	defer cancel()

	// Runs all services in the background
	eg := new(errgroup.Group)
	eg.Go(func() error { return blockPoller.Run(timeoutCtx) })
	eg.Go(func() error { return blockReceiver.Run(timeoutCtx) })
	eg.Go(func() error { return webhookConsumer.Run(timeoutCtx) })
	eg.Go(func() error { return reschedulingConsumer.Run(timeoutCtx) })

	// Fetches database queries
	queries, err := testutils.GetQueries(t, ctx, postgresC.Conn.Url)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a dummy webhook subscription (which starts the workers)
	if err := testutils.SetupWebhook(ctx, queries, *blockchainOpts, server.URL,
		WEBHOOK_RETRY_DELAY_MS,
		WEBHOOK_MAX_RETRIES,
		WEBHOOK_TIMEOUT_MS,
	); err != nil {
		t.Fatal(err)
	}

	// Waits for the timeout (processing should occur in the background while we wait)
	// Fails the test if an unexpected error occurs
	if err := eg.Wait(); err != nil && !errors.Is(err, context.DeadlineExceeded) && !strings.Contains(err.Error(), "i/o timeout") {
		t.Fatal(err)
	}

	// Checks that the correct number of http calls was made
	blockCount := 0
	if len(reqLog) == 0 {
		t.Fatal("Webhook received no blocks\n")
	} else {
		t.Logf("Total number of requests received by webhook: %d\n", len(reqLog))
		for timestamp, blocks := range reqLog {
			t.Logf("  => Received request at %s containing %d blocks", timestamp, len(blocks))
			for _, block := range blocks {
				parsedBlock, err := testutils.JsonParse[map[string]any](block)
				if err != nil {
					t.Fatal(err)
				}

				blockHeight, exists := parsedBlock["height"]
				if !exists {
					t.Fatal("block height ")
				}

				blockTime, exists := parsedBlock["timestamp"]
				if !exists {
					t.Fatal("block height ")
				}

				t.Logf("    => Received block %.0f (block timestamp = %s)\n", blockHeight, blockTime)
			}
			blockCount += len(blocks)
		}
		t.Logf("Total number of blocks received by webhook: %d\n", blockCount)
	}
}
