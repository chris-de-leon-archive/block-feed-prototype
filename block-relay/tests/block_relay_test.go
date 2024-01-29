package tests

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/cache"
	"block-relay/src/libs/common"
	"block-relay/src/libs/lib"
	"block-relay/src/libs/sqlc"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// TODO: make sure docker images are locally available using docker pull BEFORE this test file is run
// TODO: add fault tolerance test
// TODO: add latency test (i.e. what is the average time it takes for a block to be sent to a webhook once it is sealed on the chain?)
// TODO: retries are NOT fault tolerant - if a consumer crashes while processing retry 3 of 5, when it starts back up again it will start from 0
// TODO: add graceful context handling
func TestBlockRelay(t *testing.T) {
	// Defines helper constants
	const (
		BLOCK_POLLER_BATCH_SIZE       = 100
		BLOCK_POLLER_POLL_MS          = 1000
		JOB_PRODUCER_BATCH_SIZE       = 1000
		JOB_PRODUCER_MAX_WAIT_MS      = 10000
		JOB_CONSUMER_BLOCK_TIMEOUT_MS = 60000
		JOB_CONSUMER_NAME             = "webhook-job-consumer"
		JOB_CONSUMER_REPLICAS         = 3
		LOCAL_CACHE_CAPACITY          = 100
		LOCAL_CACHE_TTL_MS            = 10000
		REDIS_VERSION                 = "7.2.1-alpine3.18"
		POSTGRES_VERSION              = "16.1-alpine3.18"
		CHAIN_URL                     = "access.devnet.nodes.onflow.org:9000"
		CHAIN_ID                      = blockchains.FLOW_TESTNET
		TEST_DURATION_MS              = 5000
		WEBHOOK_MAX_RETRIES           = 2
		WEBHOOK_TIMEOUT_MS            = 5000
		WEBHOOK_RETRY_DELAY_MS        = 1000
		DUMMY_UUID                    = "550e8400-e29b-41d4-a716-446655440000"
	)

	// Defines helper variables
	var (
		ctx    = context.Background()
		blocks = []string{}
	)

	// Starts a mock server
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, req *http.Request) {
		body, err := io.ReadAll(req.Body)
		if err != nil {
			t.Fatal(err)
			return
		} else {
			defer req.Body.Close()
		}

		blocks = append(blocks, string(body))
	}))
	defer server.Close()

	// Starts a postgres container
	postgresC, err := NewPostgresContainer(ctx, t, POSTGRES_VERSION)
	if err != nil {
		t.Fatal(err)
	}

	// Starts a redis cache container
	redisCache, err := NewRedisContainer(ctx, t, REDIS_VERSION, RedisCacheCmd())
	if err != nil {
		t.Fatal(err)
	}

	// Starts a redis stream container
	redisStream, err := NewRedisContainer(ctx, t, REDIS_VERSION, RedisDefaultCmd())
	if err != nil {
		t.Fatal(err)
	}

	// Creates a database connection
	dbUrl := fmt.Sprintf("%s/%s?sslmode=disable&search_path=%s", postgresC.Conn.Url, DEFAULT_POSTGRES_DB, DEFAULT_POSTGRES_SCHEMA)
	db, err := pgx.Connect(ctx, dbUrl)
	if err != nil {
		t.Fatal(err)
	} else {
		defer func() {
			if err := db.Close(ctx); err != nil {
				t.Log(err)
			}
		}()
	}

	// Fetches database queries
	queries := sqlc.New(db)

	// Creates a dummy webhook subscription
	_, err = queries.CreateWebhook(ctx, &sqlc.CreateWebhookParams{
		ChainID:      string(CHAIN_ID),
		Url:          server.URL,
		MaxRetries:   WEBHOOK_MAX_RETRIES,
		RetryDelayMs: WEBHOOK_RETRY_DELAY_MS,
		TimeoutMs:    WEBHOOK_TIMEOUT_MS,
		CustomerID:   DUMMY_UUID,
	})
	if err != nil {
		t.Fatal(err)
	}

	// Creates a context that will be canceled at a later time
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(TEST_DURATION_MS)*time.Millisecond)
	defer cancel()

	// Runs the block poller in a separate go routine
	go func() {
		// Creates a blockchain client
		resolver := blockchains.NewChainResolver()
		defer resolver.Close(func(err error) { fmt.Printf("error: %v", err) })
		chain, err := resolver.ResolveChain(&blockchains.BlockchainOpts{
			ChainUrl: CHAIN_URL,
			ChainID:  CHAIN_ID,
		})
		if err != nil {
			t.Error(err)
			return
		}

		// Creates a database connection pool
		dbConnPool, err := pgxpool.New(ctx, dbUrl)
		if err != nil {
			t.Error(err)
			return
		} else {
			defer dbConnPool.Close()
		}

		// Creates the service
		service := lib.NewBlockPoller(lib.BlockPollerParams{
			DatabaseConnPool: dbConnPool,
			Chain:            chain,
			Opts: lib.BlockPollerOpts{
				BatchSize: BLOCK_POLLER_BATCH_SIZE,
				PollMs:    BLOCK_POLLER_POLL_MS,
			},
		})

		// Runs the service until the context is cancelled
		err = service.Run(ctx)
		if err != nil {
			t.Error(err)
			return
		}
	}()

	// Runs the job producer in a separate go routine
	go func() {
		// Creates a redis client for streaming
		redisClient := redis.NewClient(&redis.Options{Addr: redisStream.Conn.Url})
		defer func() {
			if err := redisClient.Close(); err != nil {
				common.LogError(nil, err)
			}
		}()

		// Creates a database connection pool
		dbConnPool, err := pgxpool.New(ctx, dbUrl)
		if err != nil {
			t.Error(err)
			return
		} else {
			defer dbConnPool.Close()
		}

		// Creates the service
		service := lib.NewJobProducer(lib.JobProducerParams{
			DatabaseConnPool: dbConnPool,
			RedisClient:      redisClient,
			Opts: lib.JobProducerOpts{
				BatchSize: JOB_PRODUCER_BATCH_SIZE,
				MaxWaitMs: JOB_PRODUCER_MAX_WAIT_MS,
			},
		})

		// Runs the service until the context is cancelled
		err = service.Run(ctx)
		if err != nil {
			t.Error(err)
			return
		}
	}()

	// Runs the job consumer in a separate go routine
	for i := 0; i < JOB_CONSUMER_REPLICAS; i++ {
		go func(id int) {
			// Creates a redis client
			redisStreamClient := redis.NewClient(&redis.Options{Addr: redisStream.Conn.Url})
			defer func() {
				if err := redisStreamClient.Close(); err != nil {
					common.LogError(nil, err)
				}
			}()

			// Creates a redis client for caching
			redisCacheClient := redis.NewClient(&redis.Options{Addr: redisCache.Conn.Url})
			defer func() {
				if err := redisCacheClient.Close(); err != nil {
					common.LogError(nil, err)
				}
			}()

			// Initializes the redis cache
			redisCache := cache.NewRedisCache[string, lib.CachedBlock](cache.RedisCacheParams{
				RedisClient: redisCacheClient,
				Opts: cache.RedisCacheOpts{
					LocalCacheCapacity: LOCAL_CACHE_CAPACITY,
					LocalCacheTTL:      LOCAL_CACHE_TTL_MS,
				},
			})

			// Creates a chain resolver
			chainResolver := blockchains.NewChainResolver()
			defer chainResolver.Close(func(err error) { common.LogError(nil, err) })

			// Creates the service
			service := lib.NewJobConsumer(lib.JobConsumerParams{
				RedisClient:   redisStreamClient,
				RedisCache:    redisCache,
				ChainResolver: chainResolver,
				Opts: lib.JobConsumerOpts{
					ConsumerName:   fmt.Sprintf("%s-%d", JOB_CONSUMER_NAME, id),
					BlockTimeoutMs: JOB_CONSUMER_BLOCK_TIMEOUT_MS,
				},
			})

			// Runs the service until the context is cancelled
			err := service.Run(ctx)
			if err != nil {
				t.Error(err)
				return
			}
		}(i)
	}

	// Waits for the timeout (processing should occur in the background while we wait)
	<-timeoutCtx.Done()

	// TODO: might be worth it to compare the counter to the number of blocks that arrived during the test

	// Checks that the correct number of http calls was made
	if len(blocks) == 0 {
		t.Fatal("Webhook received no blocks\n")
	} else {
		t.Logf("Number of blocks received by webhook: %d\n", len(blocks))
		for _, block := range blocks {
			data, err := common.JsonParse[map[string]any](block)
			if err != nil {
				t.Fatal(err)
			}
			height, exists := data["height"]
			if exists {
				t.Logf("Received: %.0f\n", height)
			}
		}
	}
}
