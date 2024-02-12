package e2e

import (
	"block-relay/src/libs/blockchains"
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
//	job retries / failed job handling (stream consumer)
//	individual block poller
//	individual webhook consumer
//	fault tolerance (all)
//	add timing test (i.e. what is the average time it takes for a block to be sent to a webhook once it is sealed on the chain?)
func TestBlockRelaySimple(t *testing.T) {
	// Defines helper constants
	const (
		BLOCK_POLLER_NAME                   = "test-block-poller"
		BLOCK_POLLER_MAX_IN_FLIGHT_REQUESTS = 3
		BLOCK_POLLER_BATCH_SIZE             = 10
		BLOCK_POLLER_POLL_MS                = 500

		WEBHOOK_CONSUMER_NAME             = "webhook-consumer"
		WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS = 60000
		WEBHOOK_CONSUMER_MAX_POOL_SIZE    = 3

		REDIS_VERSION = "7.2.1-alpine3.18"
		MYSQL_VERSION = "8.3.0"

		CHAIN_URL = "access.devnet.nodes.onflow.org:9000"
		CHAIN_ID  = blockchains.FLOW_TESTNET

		BLOCK_RELAY_UNAME = "block_relay_role"
		BLOCK_RELAY_PWORD = "password"

		WEBHOOK_RETRY_DELAY_MS = 1000
		WEBHOOK_MAX_RETRIES    = 3
		WEBHOOK_TIMEOUT_MS     = 5000

		TEST_DURATION_MS  = 15000
		TEST_DB_POOL_SIZE = 3
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
	defer server.Close()

	// Starts a database container
	mysqlC, err := testutils.NewMySqlContainer(ctx, t, MYSQL_VERSION)
	if err != nil {
		t.Fatal(err)
	}

	// Starts a redis container
	redisC, err := testutils.NewRedisContainer(ctx, t, REDIS_VERSION, testutils.RedisDefaultCmd())
	if err != nil {
		t.Fatal(err)
	}

	// Instead of using superuser credentials, use a role with limited permissions
	dbBlockRelayUrl := testutils.MySqlUrl(*mysqlC.Conn, BLOCK_RELAY_UNAME, BLOCK_RELAY_PWORD)

	// Creates a block poller service
	blockPoller, err := testutils.NewBlockPoller(t, ctx, redisC.Conn.Url, dbBlockRelayUrl, *blockchainOpts, services.BlockPollerOpts{
		MaxInFlightRequests: BLOCK_POLLER_MAX_IN_FLIGHT_REQUESTS,
		BatchSize:           BLOCK_POLLER_BATCH_SIZE,
		PollMs:              BLOCK_POLLER_POLL_MS,
	})
	if err != nil {
		t.Fatal(err)
	}

	// Creates a webhook consumer service
	webhookConsumer, err := testutils.NewWebhookConsumer(t, redisC.Conn.Url, dbBlockRelayUrl,
		services.StreamConsumerOpts{
			ConsumerName:   WEBHOOK_CONSUMER_NAME,
			MaxPoolSize:    WEBHOOK_CONSUMER_MAX_POOL_SIZE,
			BlockTimeoutMs: WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS,
		})
	if err != nil {
		t.Fatal(err)
	}

	// Creates a database client using the root user credentials
	dbClient, err := testutils.GetDatabaseClient(t, mysqlC.Conn.Url, TEST_DB_POOL_SIZE)
	if err != nil {
		t.Fatal(err)
	}

	// Creates one dummy webhook subscription (which starts the workers)
	if err := testutils.SetupWebhook(ctx, t,
		dbClient,
		*blockchainOpts,
		redisC.Conn.Url,
		server.URL,
		WEBHOOK_RETRY_DELAY_MS,
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
	eg.Go(func() error { return webhookConsumer.Run(timeoutCtx) })

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
			t.Logf("  => Received request at %s containing %d blocks", req.Timestamp, len(req.Blocks))
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
