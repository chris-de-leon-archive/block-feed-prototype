package main

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"block-feed/src/libs/services/processing"
	"block-feed/src/libs/streams"
	"context"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	PostgresUrl     string `validate:"required,gt=0" env:"BLOCK_CONSUMER_POSTGRES_URL,required"`
	RedisClusterUrl string `validate:"required,gt=0" env:"BLOCK_CONSUMER_REDIS_CLUSTER_URL,required"`
	RedisStreamUrl  string `validate:"required,gt=0" env:"BLOCK_CONSUMER_REDIS_STREAM_URL,required"`
	RedisStoreUrl   string `validate:"required,gt=0" env:"BLOCK_CONSUMER_REDIS_STORE_URL,required"`
	ChainID         string `validate:"required,gt=0" env:"BLOCK_CONSUMER_CHAIN_ID,required"`
	BatchSize       int64  `validate:"required,gt=0" env:"BLOCK_CONSUMER_BATCH_SIZE,required"`
	ShardCount      int    `validate:"required,gt=0" env:"BLOCK_CONSUMER_SHARD_COUNT,required"`
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

	// Creates a list of webhook streams - this service will
	// flush each of the streams as new blocks are delivered
	webhookStreams := make([]*streams.WebhookStream, envvars.ShardCount)
	for shardNum := range envvars.ShardCount {
		webhookStreams[shardNum] = streams.NewWebhookStream(redisClusterClient, shardNum)
	}

	// Creates the service
	service := processing.NewBlockStreamConsumer(processing.BlockStreamConsumerParams{
		BlockStream:    streams.NewBlockStream(redisStreamClient, envvars.ChainID),
		RedisCluster:   redisClusterClient,
		WebhookStreams: webhookStreams,
		BlockStore:     store,
		Opts: &processing.BlockStreamConsumerOpts{
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
