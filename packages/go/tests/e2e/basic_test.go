package e2e

import (
	"appenv"
	blockhook "blockrelay"
	"blockrouter"
	"cachedstore"
	"context"
	"errors"
	"io"
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

type (
	RequestLog struct {
		Timestamp string
		Blocks    []string
	}
)

// TODO: tests to add:
//
//	job retries / failed job handling (stream consumer)
//	fault tolerance (all)
//	add timing test (i.e. what is the average time it takes for a block to be sent to a webhook once it is sealed on the chain?)

// This test case performs the following:
//
//  1. It adds a webhook to redis cluster and schedules it for processing
//
//  2. It tests that the block streamer is correctly sending blocks to a block stream
//
//  3. It tests that a block consumer is able to (1) add blocks from the block stream to the blockstore and (2) reschedule any webhooks based on the latest block height
//
//  4. Then finally, it tests that block data is properly forwarded to a webhook URL from a webhook consumer
//
// This test is run against a live network for simplicity - in the future these test cases will be run against a local devnet
func TestBasic(t *testing.T) {
	// Defines helper constants
	const (
		FLOW_TESTNET_CHAIN_ID = "flow-testnet"
		FLOW_TESTNET_URL      = grpc.TestnetHost

		WEBHOOK_CONSUMER_NAME      = "webhook-consumer"
		WEBHOOK_CONSUMER_POOL_SIZE = 3

		BLOCK_CONSUMER_NAME       = "block-consumer"
		BLOCK_CONSUMER_BATCH_SIZE = 100

		BLOCK_FLUSH_INTERVAL_MS = 1000
		BLOCK_FLUSH_MAX_BLOCKS  = 5

		WEBHOOK_MAX_BLOCKS  = 1
		WEBHOOK_MAX_RETRIES = 3
		WEBHOOK_TIMEOUT_MS  = 5000

		TEST_DURATION_MS  = 10000
		TEST_NUM_WEBHOOKS = 1
		TEST_SHARDS       = int32(1)
	)

	// Defines helper variables
	var (
		ctx        = context.Background()
		reqLog     = []RequestLog{}
		customerID = uuid.NewString()
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

		reqLog = append(reqLog, RequestLog{
			Timestamp: timestamp,
			Blocks:    blocks,
		})
	}))
	t.Cleanup(func() { server.Close() })

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

	// Creates a block consumer service
	flowBlockRouter, err := testservices.NewBlockRouter(t, ctx,
		config,
		store,
		&blockrouter.BlockRouterOpts{
			ConsumerName: BLOCK_CONSUMER_NAME,
			BatchSize:    BLOCK_CONSUMER_BATCH_SIZE,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	// Creates 1 replica of a webhook stream consumer service for each shard.
	// Each service has WEBHOOK_CONSUMER_POOL_SIZE concurrent workers.
	blockRelays := make([]*blockhook.BlockRelay, TEST_SHARDS)
	for shardID := range TEST_SHARDS {
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
			&blockhook.BlockRelayOpts{
				ConsumerName: WEBHOOK_CONSUMER_NAME,
				Concurrency:  WEBHOOK_CONSUMER_POOL_SIZE,
			})
		if err != nil {
			t.Fatal(err)
		} else {
			blockRelays[shardID] = blockRelay
		}
	}

	// Creates the webhook(s)
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
