package e2e

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/processors"
	"block-relay/src/libs/services"
	"block-relay/src/libs/sqlc"
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

		BLOCK_CACHE_CONSUMER_NAME    = string(CHAIN_ID) + "-block-cache-consumer"
		BLOCK_CACHE_BLOCK_TIMEOUT_MS = 60000
		BLOCK_CACHE_POOL_SIZE        = 1

		REDIS_VERSION = "7.2.1-alpine3.18"
		MONGO_VERSION = "7.0.5"
		MYSQL_VERSION = "8.3.0"

		BLOCK_RELAY_MYSQL_UNAME = "block_relay_role"
		BLOCK_RELAY_MYSQL_PWORD = "password"

		WEBHOOK_MAX_BLOCKS  = 1
		WEBHOOK_MAX_RETRIES = 3
		WEBHOOK_TIMEOUT_MS  = 5000

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
	mysqlBlockRelayUrl := testutils.MySqlUrl(*cMySql.Conn, BLOCK_RELAY_MYSQL_UNAME, BLOCK_RELAY_MYSQL_PWORD)

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

	// Creates a webhook consumer service
	webhookConsumer, err := testutils.NewWebhookConsumer(t, ctx,
		cWebhookRedis.Conn.Url,
		mysqlBlockRelayUrl,
		testutils.MongoUrl(*cMongoDB.Conn,
			testutils.MONGO_READONLY_UNAME,
			testutils.MONGO_READONLY_PWORD,
		),
		services.StreamConsumerOpts{
			ConsumerName:     WEBHOOK_CONSUMER_NAME,
			ConsumerPoolSize: WEBHOOK_CONSUMER_POOL_SIZE,
			BlockTimeoutMs:   WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS,
		})
	if err != nil {
		t.Fatal(err)
	}

	// Creates a database client using the root user credentials
	mysqlClient, err := testutils.GetMySqlClient(t, cMySql.Conn.Url, TEST_DB_POOL_SIZE)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a blockchain in the database
	if _, err := sqlc.New(mysqlClient).UpsertBlockchain(ctx, &sqlc.UpsertBlockchainParams{
		ID:  string(blockchainOpts.ChainID),
		Url: blockchainOpts.ChainUrl,
	}); err != nil {
		t.Fatal(err)
	}

	// Creates one dummy webhook subscription (which starts the workers)
	if err := testutils.SetupWebhook(ctx, t,
		mysqlClient,
		chain,
		cWebhookRedis.Conn.Url,
		server.URL,
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
