package redis

import (
	"fmt"
	"testing"

	"github.com/redis/go-redis/v9"
)

func GetRedisClient(t *testing.T, url string) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:                  url,
		ContextTimeoutEnabled: true,
	})

	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Log(err)
		}
	})

	return client, nil
}

func GetTempRedisClient[T any](url string, cb func(client *redis.Client) (T, error)) (T, error) {
	client := redis.NewClient(&redis.Options{
		Addr:                  url,
		ContextTimeoutEnabled: true,
	})

	defer func() {
		if err := client.Close(); err != nil {
			fmt.Println(err)
		}
	}()

	return cb(client)
}

func GetRedisClusterClient(t *testing.T, url string) (*redis.ClusterClient, error) {
	client := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs:                 []string{url},
		ContextTimeoutEnabled: true,
	})

	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Log(err)
		}
	})

	return client, nil
}

func GetTempRedisClusterClient[T any](url string, cb func(client *redis.ClusterClient) (T, error)) (T, error) {
	client := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs:                 []string{url},
		ContextTimeoutEnabled: true,
	})

	defer func() {
		if err := client.Close(); err != nil {
			fmt.Println(err)
		}
	}()

	return cb(client)
}
