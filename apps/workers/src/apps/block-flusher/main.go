package main

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"context"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	PostgresUrl     string `validate:"required,gt=0" env:"BLOCK_FLUSHER_POSTGRES_URL,required"`
	RedisStoreUrl   string `validate:"required,gt=0" env:"BLOCK_FLUSHER_REDIS_STORE_URL,required"`
	ChainID         string `validate:"required,gt=0" env:"BLOCK_FLUSHER_CHAIN_ID,required"`
	FlushIntervalMs int    `validate:"required,gt=0" env:"BLOCK_FLUSHER_INTERVAL_MS,required"`
	MaxBlocks       int    `validate:"required,gt=0" env:"BLOCK_FLUSHER_MAX_BLOCKS,required"`
}

// NOTE: only one replica of this service is needed
func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Loads env variables into a struct and validates them
	envvars, err := config.LoadEnvVars[EnvVars]()
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
	pgClient, err := pgxpool.New(ctx, envvars.PostgresUrl)
	if err != nil {
		panic(err)
	}
	defer pgClient.Close()

	// Creates a blockstore
	store := blockstore.NewRedisOptimizedBlockStore(
		blockstore.NewTimescaleBlockStore(pgClient),
		blockstore.NewRedisBlockStore(redisStoreClient),
	)

	// Initializes the store
	if err := store.Init(ctx, envvars.ChainID); err != nil {
		panic(err)
	}

	// Defines the flush options
	flushOpts := blockstore.RedisOptimizedBlockStoreFlushOpts{
		IntervalMs: envvars.FlushIntervalMs,
		MaxBlocks:  envvars.MaxBlocks,
	}

	// Periodically flushes blocks from the cache to the database
	if err := store.StartFlushing(ctx, envvars.ChainID, flushOpts); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
