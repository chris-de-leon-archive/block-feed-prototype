package main

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/cache"
	"block-relay/src/libs/common"
	"block-relay/src/libs/lib"
	"context"
	"os/signal"
	"syscall"

	"github.com/caarlos0/env"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	RedisStreamUrl     string `validate:"required,gt=0" env:"JOB_CONSUMER_REDIS_STREAM_URL,required"`
	RedisCacheUrl      string `validate:"required,gt=0" env:"JOB_CONSUMER_REDIS_CACHE_URL,required"`
	ConsumerName       string `validate:"required,gt=0" env:"JOB_CONSUMER_NAME,required"`
	LocalCacheTTL      int    `validate:"required,gt=0" env:"JOB_CONSUMER_LOCAL_CACHE_TTL_MS,required"`
	LocalCacheCapacity int    `validate:"required,gt=0" env:"JOB_CONSUMER_LOCAL_CACHE_CAPACITY,required"`
	BlockTimeoutMs     int    `validate:"required,gte=0" env:"JOB_CONSUMER_BLOCK_TIMEOUT_MS,required"`
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

	// Creates a redis stream client
	redisStreamClient := redis.NewClient(&redis.Options{Addr: envvars.RedisStreamUrl})
	defer func() {
		if err := redisStreamClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates a redis cache client
	redisCacheClient := redis.NewClient(&redis.Options{Addr: envvars.RedisCacheUrl})
	defer func() {
		if err := redisCacheClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Initializes the redis cache
	redisCache := cache.NewRedisCache[string, lib.CachedBlock](cache.RedisCacheParams{
		RedisClient: redisCacheClient,
		Opts: cache.RedisCacheOpts{
			LocalCacheCapacity: envvars.LocalCacheCapacity,
			LocalCacheTTL:      envvars.LocalCacheTTL,
		},
	})

	// Creates a chain resolver
	chainResolver := blockchains.NewChainResolver()
	defer chainResolver.Close(func(err error) { common.LogError(nil, err) })

	// Creates the service
	service := lib.NewJobConsumer(lib.JobConsumerParams{
		RedisClient:   redisStreamClient,
		RedisCache:    redisCache,
		ChainResolver: chainResolver,
		Opts: lib.JobConsumerOpts{
			ConsumerName:   envvars.ConsumerName,
			BlockTimeoutMs: envvars.BlockTimeoutMs,
		},
	})

	// Runs the service until the context is cancelled
	err := service.Run(ctx)
	if err != nil {
		panic(err)
	}
}
