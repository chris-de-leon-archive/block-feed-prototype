package main

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"block-feed/src/libs/redis/redicluster"
	"block-feed/src/libs/services/processing"
	"block-feed/src/libs/streams"
	"context"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	PostgresUrl      string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_POSTGRES_URL,required"`
	RedisClusterUrl  string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_REDIS_CLUSTER_URL,required"`
	RedisStoreUrl    string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_REDIS_STORE_URL,required"`
	ChainID          string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_CHAIN_ID,required"`
	ConsumerName     string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_NAME,required"`
	ConsumerPoolSize int    `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_POOL_SIZE,required"`
	ShardNum         int    `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_SHARD_NUM,required"`
}

// NOTE: many replicas of this service can be created
func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Loads env variables into a struct and validates them
	envvars, err := config.LoadEnvVars[EnvVars]()
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

	// Creates the service
	service := processing.NewWebhookStreamConsumer(processing.WebhookStreamConsumerParams{
		WebhookStream: streams.NewWebhookStream(redisClusterClient, envvars.ShardNum-1),
		RedisCluster:  redicluster.NewRedisCluster(redisClusterClient),
		BlockStore:    store,
		Opts: &processing.WebhookStreamConsumerOpts{
			ConsumerName: envvars.ConsumerName,
			Concurrency:  envvars.ConsumerPoolSize,
		},
	})

	// Runs the consumer until the context is cancelled
	if err = service.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
