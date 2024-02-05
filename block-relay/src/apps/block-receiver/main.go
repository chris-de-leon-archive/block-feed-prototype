package main

import (
	"block-relay/src/libs/common"
	"block-relay/src/libs/services"
	"context"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	DatabaseUrl    string `validate:"required,gt=0" env:"BLOCK_RECEIVER_DATABASE_URL,required"`
	RedisStreamUrl string `validate:"required,gt=0" env:"BLOCK_RECEIVER_REDIS_STREAM_URL,required"`
	BatchSize      int32  `validate:"required,gt=0" env:"BLOCK_RECEIVER_BATCH_SIZE,required"`
	MaxWaitMs      int    `validate:"required,gt=0" env:"BLOCK_RECEIVER_MAX_WAIT_MS,required"`
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

	// Creates a redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr:                  envvars.RedisStreamUrl,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates a database connection pool
	dbConnPool, err := pgxpool.New(ctx, envvars.DatabaseUrl)
	if err != nil {
		panic(err)
	} else {
		defer dbConnPool.Close()
	}

	// Creates the service
	service := services.NewBlockReceiver(services.BlockReceiverParams{
		DatabaseConnPool: dbConnPool,
		RedisClient:      redisClient,
		Opts: services.BlockReceiverOpts{
			BatchSize: envvars.BatchSize,
			MaxWaitMs: envvars.MaxWaitMs,
		},
	})

	// Runs the service until the context is cancelled
	err = service.Run(ctx)
	if err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
