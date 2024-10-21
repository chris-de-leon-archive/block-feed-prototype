package main

import (
	"context"
	"os/signal"
	"syscall"

	"github.com/chris-de-leon/block-feed-prototype/appenv"
	"github.com/chris-de-leon/block-feed-prototype/block-stores/cachedstore"
	"github.com/chris-de-leon/block-feed-prototype/block-stores/redistore"
	"github.com/chris-de-leon/block-feed-prototype/block-stores/timescalestore"
	"github.com/chris-de-leon/block-feed-prototype/common"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	appenv.ChainEnv
	FlushIntervalMs int `validate:"required,gt=0" env:"BLOCK_FLUSHER_INTERVAL_MS,required"`
	FlushThreshold  int `validate:"required,gt=0" env:"BLOCK_FLUSHER_THRESHOLD,required"`
}

// NOTE: only one replica of this service is needed per chain
func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Loads env variables into a struct and validates them
	envvars, err := appenv.LoadEnvVars[EnvVars]()
	if err != nil {
		panic(err)
	}

	// Creates a redis store client
	redisStoreClient := redis.NewClient(&redis.Options{
		Addr:                  envvars.RedisStoreUrl,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisStoreClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates a database connection pool
	pgClient, err := pgxpool.New(ctx, envvars.PgStoreUrl)
	if err != nil {
		panic(err)
	}
	defer pgClient.Close()

	// Creates a block store
	store := cachedstore.NewRedisOptimizedBlockStore(
		timescalestore.NewTimescaleBlockStore(pgClient),
		redistore.NewRedisBlockStore(redisStoreClient),
	)

	// Initializes the store
	if err := store.Init(ctx, envvars.ChainID); err != nil {
		panic(err)
	}

	// Defines the flush options
	flushOpts := cachedstore.RedisOptimizedBlockStoreFlushOpts{
		IntervalMs: envvars.FlushIntervalMs,
		Threshold:  envvars.FlushThreshold,
	}

	// Periodically flushes blocks from the cache to the database
	if err := store.StartFlushing(ctx, envvars.ChainID, flushOpts); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
