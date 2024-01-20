package cache

import (
	"block-relay/src/libs/common"
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

type (
	RedisCacheOptsEnv struct {
		ConnectionURL string `env:"REDIS_CACHE_CONNECTION_URL"`
		MaxKeys       string `env:"REDIS_CACHE_MAX_KEYS"`
		TTL           string `env:"REDIS_CACHE_TTL_MS"`
	}

	RedisCacheOpts struct {
		ConnectionURL string `validate:"required"`
		MaxKeys       uint64 `validate:"gt=0"`
		TTL           uint64 `validate:"gt=0"`
	}

	RedisCache[K comparable, V any] struct {
		localCache *LRUCache[K, V]
		client     *redis.Client
		opts       *RedisCacheOpts
	}
)

func NewRedisCache[K comparable, V any]() (*RedisCache[K, V], error) {
	// Parses env variables
	opts, err := common.ParseOpts[RedisCacheOptsEnv, RedisCacheOpts](func(env *RedisCacheOptsEnv) (*RedisCacheOpts, error) {
		maxKeys, err := strconv.ParseUint(env.MaxKeys, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("could not parse MaxKeys value \"%s\" as uint64: %v", env.MaxKeys, err)
		}

		ttl, err := strconv.ParseUint(env.TTL, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("could not parse TTL value \"%s\" as uint64: %v", env.TTL, err)
		}

		return &RedisCacheOpts{
			ConnectionURL: env.ConnectionURL,
			MaxKeys:       maxKeys,
			TTL:           ttl,
		}, nil
	})
	if err != nil {
		return nil, err
	}

	// Creates a redis client
	client := redis.NewClient(&redis.Options{
		Addr:     opts.ConnectionURL,
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	// Returns a redis cache instance
	return &RedisCache[K, V]{
		localCache: NewLRUCache[K, V](opts.MaxKeys),
		client:     client,
		opts:       opts,
	}, nil
}

func (redisCache *RedisCache[K, V]) Put(ctx context.Context, key K, val V) error {
	// Puts the key in the in-memory cache
	redisCache.localCache.Put(key, val, time.Duration(redisCache.opts.TTL)*time.Millisecond)

	// Puts the key in Redis
	err := redisCache.client.Do(ctx, "SET", key, val, "PX", time.Duration(redisCache.opts.TTL)*time.Millisecond).Err()
	if err != nil {
		return err
	}

	// Returns nil
	return nil
}

func (redisCache *RedisCache[K, V]) Get(ctx context.Context, key K) (*V, error) {
	// Checks if the key exists in the in-memory cache
	val := redisCache.localCache.Get(key)
	if val != nil {
		return val, nil
	}

	// Checks if the key exists in Redis
	result, err := redisCache.client.Do(ctx, "GET", key).Result()
	switch {
	case errors.Is(err, redis.Nil):
		return nil, nil
	case err != nil:
		return nil, err
	}

	// Returns the value
	return result.(*V), nil
}

func (redisCache *RedisCache[K, V]) Close() {
	defer redisCache.client.Close()
}
