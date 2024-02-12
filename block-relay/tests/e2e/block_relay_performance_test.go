package e2e

import (
	"block-relay/src/libs/blockchains"
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

func TestBlockRelayPerformance(t *testing.T) {
	// Defines helper constants
	const (
		BLOCK_POLLER_NAME                   = "test-block-poller"
		BLOCK_POLLER_MAX_IN_FLIGHT_REQUESTS = 3
		BLOCK_POLLER_BATCH_SIZE             = 10
		BLOCK_POLLER_POLL_MS                = 500

		WEBHOOK_CONSUMER_NAME             = "webhook-consumer"
		WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS = 60000
		WEBHOOK_CONSUMER_MAX_POOL_SIZE    = 3
		WEBHOOK_CONSUMER_REPLICAS         = 5

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
		TEST_NUM_WEBHOOKS = 100
		TEST_DB_POOL_SIZE = 3
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

	// Creates multiple webhook consumer services
	webhookConsumers := make([]*services.StreamConsumer, WEBHOOK_CONSUMER_REPLICAS)
	for i := 0; i < WEBHOOK_CONSUMER_REPLICAS; i++ {
		webhookConsumer, err := testutils.NewWebhookConsumer(t, redisC.Conn.Url, dbBlockRelayUrl,
			services.StreamConsumerOpts{
				ConsumerName:   fmt.Sprintf("%s-%d", WEBHOOK_CONSUMER_NAME, i),
				MaxPoolSize:    WEBHOOK_CONSUMER_MAX_POOL_SIZE,
				BlockTimeoutMs: WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS,
			},
		)
		if err != nil {
			t.Fatal(err)
		} else {
			webhookConsumers[i] = webhookConsumer
		}
	}

	// Creates a database client using the root user credentials
	dbClient, err := testutils.GetDatabaseClient(t, mysqlC.Conn.Url, TEST_DB_POOL_SIZE)
	if err != nil {
		t.Fatal(err)
	}

	// Spawns a webhook server
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) { counter += 1 }))
	defer server.Close()

	// Creates several webhook servers
	serverURLs := make([]string, TEST_NUM_WEBHOOKS)
	for i := 0; i < TEST_NUM_WEBHOOKS; i++ {
		serverURLs[i] = server.URL
	}

	// Creates and activates the webhooks
	if err := testutils.SetupWebhooks(ctx, t,
		dbClient,
		*blockchainOpts,
		redisC.Conn.Url,
		serverURLs,
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
	t.Logf("server \"%d\" received %d requests", 0, counter)
}
