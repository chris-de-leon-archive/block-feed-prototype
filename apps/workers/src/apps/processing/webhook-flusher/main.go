package main

import (
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"block-feed/src/libs/eventbus"
	"block-feed/src/libs/messaging"
	"block-feed/src/libs/services/processing"
	"block-feed/src/libs/streams"
	"context"
	"os/signal"
	"syscall"

	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	WebhookStreamRedisUrl string `validate:"required,gt=0" env:"WEBHOOK_FLUSHER_REDIS_WEBHOOK_STREAM_URL,required"`
	BlockStreamRedisUrl   string `validate:"required,gt=0" env:"WEBHOOK_FLUSHER_REDIS_BLOCK_STREAM_URL,required"`
	BlockchainId          string `validate:"required,gt=0" env:"WEBHOOK_FLUSHER_BLOCKCHAIN_ID,required"`
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
	service := processing.NewWebhookFlusher(processing.WebhookFlusherParams{
		EventBus:      eventbus.NewRedisEventBus[messaging.WebhookFlushStreamMsgData](redisBlockStreamClient),
		WebhookStream: streams.NewRedisWebhookStream(redisWebhookStreamClient),
		Opts: &processing.WebhookFlusherOpts{
			ChannelName: envvars.BlockchainId,
		},
	})

	// Runs the service until the context is cancelled
	if err = service.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
