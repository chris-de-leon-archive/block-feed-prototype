package main

import (
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"block-feed/src/libs/services"
	"context"
	"os/signal"
	"syscall"

	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	WebhookStreamRedisUrl string `validate:"required,gt=0" env:"BLOCK_FLUSHER_REDIS_WEBHOOK_STREAM_URL,required"`
	BlockStreamRedisUrl   string `validate:"required,gt=0" env:"BLOCK_FLUSHER_REDIS_BLOCK_STREAM_URL,required"`
	BlockTimeoutMs        int    `validate:"required,gt=0" env:"BLOCK_FLUSHER_BLOCK_TIMEOUT_MS,required"`
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

	// Creates a redis client
	redisWebhookStreamClient := redis.NewClient(&redis.Options{
		Addr:                  envvars.WebhookStreamRedisUrl,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisWebhookStreamClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates a redis client
	redisBlockStreamClient := redis.NewClient(&redis.Options{
		Addr:                  envvars.BlockStreamRedisUrl,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisBlockStreamClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates the service
	service := services.NewBlockFlusher(services.BlockFlusherParams{
		WebhookStreamRedisClient: redisWebhookStreamClient,
		BlockStreamRedisClient:   redisBlockStreamClient,
		Opts: &services.BlockFlusherOpts{
			BlockTimeoutMs: envvars.BlockTimeoutMs,
		},
	})

	// Runs the service until the context is cancelled
	if err = service.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
