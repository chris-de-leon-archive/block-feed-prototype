package main

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"block-feed/src/libs/db"
	"block-feed/src/libs/services/processing"
	"block-feed/src/libs/streams"
	"context"
	"database/sql"
	"os/signal"
	"syscall"
	"time"

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

	// Creates the service
	service := processing.NewWebhookConsumer(processing.WebhookConsumerParams{
		BlockStore:    blockstore.NewTimescaleBlockStore(pgClient),
		WebhookStream: streams.NewRedisWebhookStream(redisClient),
		Database:      db.NewDatabase(mysqlClient),
		Opts: &processing.WebhookConsumerOpts{
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
