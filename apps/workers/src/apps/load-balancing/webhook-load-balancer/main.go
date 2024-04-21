package main

import (
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"block-feed/src/libs/services/loadbalancing"
	"block-feed/src/libs/streaming"
	"context"
	"database/sql"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	MySqlUrl                string `validate:"required,gt=0" env:"WEBHOOK_LB_MYSQL_URL,required"`
	RedisUrl                string `validate:"required,gt=0" env:"WEBHOOK_LB_REDIS_URL,required"`
	ConsumerName            string `validate:"required,gt=0" env:"WEBHOOK_LB_NAME,required"`
	MySqlConnectionPoolSize int    `validate:"required,gt=0" env:"WEBHOOK_LB_MYSQL_CONN_POOL_SIZE,required"`
	ConsumerPoolSize        int    `validate:"required,gt=0" env:"WEBHOOK_LB_POOL_SIZE,required"`
	LockRetryAttempts       int    `validate:"required,gte=0" env:"WEBHOOK_LB_LOCK_RETRY_ATTEMPTS,required"`
	LockExpBackoffInitMs    int    `validate:"required,gte=0" env:"WEBHOOK_LB_LOCK_EXP_BACKOFF_INIT_MS,required"`
	LockExpBackoffMaxRandMs int    `validate:"required,gte=0" env:"WEBHOOK_LB_LOCK_EXP_BACKOFF_MAX_RAND_MS,required"`
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
	service := loadbalancing.NewWebhookLoadBalancer(loadbalancing.WebhookLoadBalancerParams{
		WebhookLoadBalancerStream: streaming.NewRedisWebhookLoadBalancerStream(redisClient),
		MySqlClient:               mysqlClient,
		Opts: &loadbalancing.WebhookLoadBalancerOpts{
			LockExpBackoffMaxRandMs: envvars.LockExpBackoffMaxRandMs,
			LockExpBackoffInitMs:    envvars.LockExpBackoffInitMs,
			LockRetryAttempts:       envvars.LockRetryAttempts,
			Concurrency:             envvars.ConsumerPoolSize,
			ConsumerName:            envvars.ConsumerName,
		},
	})

	// Runs the consumer until the context is cancelled
	if err = service.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
