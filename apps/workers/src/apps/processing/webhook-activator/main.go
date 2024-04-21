package main

import (
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
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	MySqlUrl                string `validate:"required,gt=0" env:"WEBHOOK_ACTIVATOR_MYSQL_URL,required"`
	RedisUrl                string `validate:"required,gt=0" env:"WEBHOOK_ACTIVATOR_REDIS_URL,required"`
	ConsumerName            string `validate:"required,gt=0" env:"WEBHOOK_ACTIVATOR_NAME,required"`
	MySqlConnectionPoolSize int    `validate:"required,gt=0" env:"WEBHOOK_ACTIVATOR_MYSQL_CONN_POOL_SIZE,required"`
	ConsumerPoolSize        int    `validate:"required,gt=0" env:"WEBHOOK_ACTIVATOR_POOL_SIZE,required"`
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
	service := processing.NewWebhookActivator(processing.WebhookActivatorParams{
		WebhookActivationStream: streams.NewRedisWebhookActivationStream(redisClient),
		Database:                db.NewDatabase(mysqlClient),
		Opts: &processing.WebhookActivatorOpts{
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
