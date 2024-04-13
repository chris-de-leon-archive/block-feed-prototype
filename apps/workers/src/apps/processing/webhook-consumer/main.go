package main

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"block-feed/src/libs/constants"
	"block-feed/src/libs/processors"
	"block-feed/src/libs/services"
	"context"
	"database/sql"
	"os/signal"
	"syscall"
	"time"

	// https://www.mongodb.com/docs/drivers/go/current/fundamentals/connections/network-compression/#compression-algorithm-dependencies
	_ "compress/zlib"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	PostgresUrl             string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_POSTGRES_URL,required"`
	MySqlUrl                string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_MYSQL_URL,required"`
	RedisUrl                string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_REDIS_URL,required"`
	ConsumerName            string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_NAME,required"`
	MySqlConnectionPoolSize int    `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_MYSQL_CONN_POOL_SIZE,required"`
	ConsumerPoolSize        int    `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_POOL_SIZE,required"`
	BlockTimeoutMs          int    `validate:"required,gte=0" env:"WEBHOOK_CONSUMER_BLOCK_TIMEOUT_MS,required"`
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
	pgClient, err := pgxpool.New(ctx, envvars.PostgresUrl)
	if err != nil {
		panic(err)
	}
	defer pgClient.Close()

	// Creates a mysql client
	mysqlClient, err := sql.Open("mysql", envvars.MySqlUrl)
	if err != nil {
		panic(err)
	} else {
		defer func() {
			if err := mysqlClient.Close(); err != nil {
				common.LogError(nil, err)
			}
		}()
		mysqlClient.SetConnMaxLifetime(time.Duration(30) * time.Second)
		mysqlClient.SetMaxOpenConns(envvars.MySqlConnectionPoolSize)
		mysqlClient.SetMaxIdleConns(envvars.MySqlConnectionPoolSize)
	}

	// Creates the consumer
	consumer := services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisClient,
		Processor: processors.NewWebhookProcessor(processors.WebhookProcessorParams{
			BlockStore:  blockstore.NewTimescaleBlockStore(pgClient),
			MySqlClient: mysqlClient,
			RedisClient: redisClient,
		}),
		Opts: &services.StreamConsumerOpts{
			StreamName:        constants.WEBHOOK_STREAM,
			ConsumerGroupName: constants.WEBHOOK_STREAM_CONSUMER_GROUP_NAME,
			ConsumerName:      envvars.ConsumerName,
			ConsumerPoolSize:  envvars.ConsumerPoolSize,
			BlockTimeoutMs:    envvars.BlockTimeoutMs,
		},
	})

	// Runs the consumer until the context is cancelled
	if err = consumer.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
