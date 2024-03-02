package main

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"block-feed/src/libs/constants"
	"block-feed/src/libs/processors"
	"block-feed/src/libs/services"
	"context"
	"os/signal"
	"syscall"

	// https://www.mongodb.com/docs/drivers/go/current/fundamentals/connections/network-compression/#compression-algorithm-dependencies
	_ "compress/zlib"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type EnvVars struct {
	MongoUrl          string `validate:"required,gt=0" env:"BLOCK_CONSUMER_MONGO_URL,required"`
	MongoDatabaseName string `validate:"required,gt=0" env:"BLOCK_CONSUMER_MONGO_DATABASE_NAME,required"`
	RedisUrl          string `validate:"required,gt=0" env:"BLOCK_CONSUMER_REDIS_URL,required"`
	BlockchainId      string `validate:"required,gt=0" env:"BLOCK_CONSUMER_BLOCKCHAIN_ID,required"`
	ConsumerName      string `validate:"required,gt=0" env:"BLOCK_CONSUMER_NAME,required"`
	BlockTimeoutMs    int    `validate:"required,gte=0" env:"BLOCK_CONSUMER_BLOCK_TIMEOUT_MS,required"`
}

func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Loads env variables into a struct and validates them
	envvars, err := config.LoadEnvVars[EnvVars]()
	if err != nil {
		panic(err)
	}

	// Creates a redis stream client
	redisClient := redis.NewClient(&redis.Options{
		Addr:                  envvars.RedisUrl,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates a database connection pool
	mongoClient, err := mongo.Connect(ctx, options.Client().ApplyURI(envvars.MongoUrl))
	if err != nil {
		panic(err)
	}
	defer func() {
		if err := mongoClient.Disconnect(context.Background()); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates the consumer
	consumer := services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisClient,
		Processor: processors.NewBlockProcessor(processors.BlockProcessorParams{
			BlockStore:  blockstore.NewMongoBlockStore(mongoClient, envvars.MongoDatabaseName),
			RedisClient: redisClient,
			Opts: &processors.BlockProcessorOpts{
				ChainID: envvars.BlockchainId,
			},
		}),
		Opts: &services.StreamConsumerOpts{
			StreamName:        constants.BLOCK_STREAM,
			ConsumerGroupName: constants.BLOCK_STREAM_CONSUMER_GROUP_NAME,
			ConsumerName:      envvars.ConsumerName,
			BlockTimeoutMs:    envvars.BlockTimeoutMs,
			ConsumerPoolSize:  1,
		},
	})

	// Runs the consumer until the context is cancelled
	if err = consumer.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
