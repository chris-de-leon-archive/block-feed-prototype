package main

import (
	"appenv"
	"blockrouter"
	"cachedstore"
	"common"
	"context"
	"os/signal"
	"redistore"
	"streams"
	"syscall"
	"timescalestore"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	appenv.ChainEnv
	BatchSize int64 `validate:"required,gt=0" env:"BLOCK_CONSUMER_BATCH_SIZE,required"`
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

	// Creates a redis cluster client
	redisClusterClient := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs:                 []string{envvars.RedisClusterUrl},
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisClusterClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates a redis stream client
	redisStreamClient := redis.NewClient(&redis.Options{
		Addr:                  envvars.RedisStreamUrl,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisStreamClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

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

	// Creates a postgres connection pool
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

	// Creates a list of webhook streams - this service will
	// reschedule jobs for each of the streams as new blocks
	// are delivered
	webhookStreams := make([]*streams.WebhookStream, envvars.ShardCount)
	for shardID := range envvars.ShardCount {
		webhookStreams[shardID] = streams.NewWebhookStream(redisClusterClient, shardID)
	}

	// Creates the service
	service := blockrouter.NewBlockRouter(blockrouter.BlockRouterParams{
		BlockStream:    streams.NewBlockStream(redisStreamClient, envvars.ChainID),
		WebhookStreams: webhookStreams,
		BlockStore:     store,
		Opts: &blockrouter.BlockRouterOpts{
			ConsumerName: envvars.ChainID,
			BatchSize:    envvars.BatchSize,
		},
	})

	// Runs the consumer until the context is cancelled
	if err = service.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
