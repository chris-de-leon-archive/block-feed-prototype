package main

import (
	"block-relay/src/libs/common"
	"block-relay/src/libs/lib"
	"context"
	"os/signal"
	"syscall"

	"github.com/caarlos0/env"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	DatabaseUrl    string `validate:"required,gt=0" env:"JOB_PRODUCER_DATABASE_URL,required"`
	RedisStreamUrl string `validate:"required,gt=0" env:"JOB_PRODUCER_REDIS_STREAM_URL,required"`
	BatchSize      int32  `validate:"required,gt=0" env:"JOB_PRODUCER_BATCH_SIZE,required"`
	MaxWaitMs      int32  `validate:"required,gt=0" env:"JOB_PRODUCER_MAX_WAIT_MS,required"`
}

func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Parses env variables into a struct
	envvars := EnvVars{}
	if err := env.Parse(&envvars); err != nil {
		panic(err)
	}

	// Validates the env variables
	if err := common.ValidateStruct[EnvVars](envvars); err != nil {
		panic(err)
	}

	// Creates a redis client
	redisClient := redis.NewClient(&redis.Options{Addr: envvars.RedisStreamUrl})
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
	service := lib.NewJobProducer(lib.JobProducerParams{
		DatabaseConnPool: dbConnPool,
		RedisClient:      redisClient,
		Opts: lib.JobProducerOpts{
			BatchSize: envvars.BatchSize,
			MaxWaitMs: envvars.MaxWaitMs,
		},
	})

	// Runs the service until the context is cancelled
	err = service.Run(ctx)
	if err != nil {
		panic(err)
	}
}
