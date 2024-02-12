package main

import (
	"block-relay/src/libs/common"
	"block-relay/src/libs/constants"
	"block-relay/src/libs/processors"
	"block-relay/src/libs/services"
	"context"
	"database/sql"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	DatabaseUrl      string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_DATABASE_URL,required"`
	RedisStreamUrl   string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_REDIS_STREAM_URL,required"`
	ConsumerName     string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_NAME,required"`
	DatabasePoolSize int    `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_DATABASE_POOL_SIZE,required"`
	MaxPoolSize      int    `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_MAX_POOL_SIZE,required"`
	BlockTimeoutMs   int    `validate:"required,gte=0" env:"WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS,required"`
}

func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Loads env variables into a struct and validates them
	envvars, err := common.LoadEnvVars[EnvVars]()
	if err != nil {
		panic(err)
	}

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

	// Creates a database connection pool
	db, err := sql.Open("mysql", envvars.DatabaseUrl)
	if err != nil {
		panic(err)
	} else {
		defer db.Close()
		db.SetConnMaxLifetime(time.Duration(30) * time.Second)
		db.SetMaxOpenConns(envvars.DatabasePoolSize)
		db.SetMaxIdleConns(envvars.DatabasePoolSize)
	}

	// Creates the consumer
	consumer := services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisStreamClient,
		Processor: processors.NewWebhookProcessor(processors.WebhookProcessorParams{
			RedisClient: redisStreamClient,
		}),
		Opts: &services.StreamConsumerOpts{
			StreamName:        constants.WEBHOOK_STREAM,
			ConsumerGroupName: constants.WEBHOOK_CONSUMER_GROUP_NAME,
			ConsumerName:      envvars.ConsumerName,
			MaxPoolSize:       envvars.MaxPoolSize,
			BlockTimeoutMs:    envvars.BlockTimeoutMs,
		},
	})

	// Runs the consumer until the context is cancelled
	err = consumer.Run(ctx)
	if err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
