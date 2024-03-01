package main

import (
	"block-relay/src/libs/common"
	"block-relay/src/libs/config"
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
	MySqlUrl                string `validate:"required,gt=0" env:"WEBHOOK_LB_CONSUMER_MYSQL_URL,required"`
	RedisUrl                string `validate:"required,gt=0" env:"WEBHOOK_LB_CONSUMER_REDIS_URL,required"`
	ConsumerName            string `validate:"required,gt=0" env:"WEBHOOK_LB_CONSUMER_NAME,required"`
	MySqlConnectionPoolSize int    `validate:"required,gt=0" env:"WEBHOOK_LB_CONSUMER_MYSQL_CONN_POOL_SIZE,required"`
	ConsumerPoolSize        int    `validate:"required,gt=0" env:"WEBHOOK_LB_CONSUMER_POOL_SIZE,required"`
	BlockTimeoutMs          int    `validate:"required,gte=0" env:"WEBHOOK_LB_CONSUMER_BLOCK_TIMEOUT_MS,required"`
	LockRetryAttempts       int    `validate:"required,gte=0" env:"WEBHOOK_LB_CONSUMER_LOCK_RETRY_ATTEMPTS,required"`
	LockExpBackoffInitMs    int    `validate:"required,gte=0" env:"WEBHOOK_LB_CONSUMER_LOCK_EXP_BACKOFF_INIT_MS,required"`
	LockExpBackoffMaxRandMs int    `validate:"required,gte=0" env:"WEBHOOK_LB_CONSUMER_LOCK_EXP_BACKOFF_MAX_RAND_MS,required"`
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

	// Creates the consumer
	consumer := services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisClient,
		Processor: processors.NewWebhookLoadBalancerProcessor(processors.WebhookLoadBalancerProcessorParams{
			MySqlClient: mysqlClient,
			RedisClient: redisClient,
			Opts: &processors.WebhookLoadBalancerProcessorOpts{
				LockRetryAttempts:       envvars.LockRetryAttempts,
				LockExpBackoffInitMs:    envvars.LockExpBackoffInitMs,
				LockExpBackoffMaxRandMs: envvars.LockExpBackoffMaxRandMs,
			},
		}),
		Opts: &services.StreamConsumerOpts{
			StreamName:        constants.WEBHOOK_LOAD_BALANCER_STREAM,
			ConsumerGroupName: constants.WEBHOOK_LOAD_BALANCER_STREAM_CONSUMER_GROUP_NAME,
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
