package cache

import (
	"block-relay/src/libs/common"
	"context"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

type (
	RedisCacheOpts struct {
		LocalCacheCapacity int
		LocalCacheTTL      int
	}

	RedisCacheParams struct {
		RedisClient *redis.Client
		Opts        RedisCacheOpts
	}

	RedisCache[K comparable, V any] struct {
		localCache  *LRUCache[K, V]
		redisClient *redis.Client
		opts        *RedisCacheOpts
	}
)

func NewRedisCache[K comparable, V any](params RedisCacheParams) *RedisCache[K, V] {
	// Creates an in-memory LRU cache
	lruCache := NewLRUCache[K, V](LRUCacheOpts{
		Capacity: params.Opts.LocalCacheCapacity,
	})

	// Returns a redis cache instance
	return &RedisCache[K, V]{
		localCache:  lruCache,
		redisClient: params.RedisClient,
		opts:        &params.Opts,
	}
}

func (redisCache *RedisCache[K, V]) Put(ctx context.Context, key K, val V) error {
	// Puts the key in the in-memory cache
	redisCache.localCache.Put(key, val, time.Duration(redisCache.opts.LocalCacheTTL)*time.Millisecond)

	// JSON encodes the value
	data, err := common.JsonStringify(val)
	if err != nil {
		return err
	}

	// Puts the key in Redis
	err = redisCache.redisClient.Do(ctx, "SET", key, data).Err()
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
	result, err := redisCache.redisClient.Do(ctx, "GET", key).Text()
	switch {
	case errors.Is(err, redis.Nil):
		return nil, nil
	case err != nil:
		return nil, err
	}

	// If we can successfully cast the raw result to the desired value type return it
	data, err := common.JsonParse[V](result)
	if err != nil {
		return nil, err
	}

	// Returns the value
	return &data, nil
}
