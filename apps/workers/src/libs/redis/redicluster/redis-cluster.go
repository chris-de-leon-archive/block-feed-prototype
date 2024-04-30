package redicluster

import (
	"github.com/redis/go-redis/v9"
)

type (
	RedisCluster struct {
		Webhooks *WebhookManager
	}

	Webhook struct {
		ID           string
		URL          string
		BlockchainID string
		MaxRetries   int64
		MaxBlocks    int64
		TimeoutMs    int
	}
)

func NewRedisCluster(client *redis.ClusterClient) *RedisCluster {
	return &RedisCluster{
		Webhooks: &WebhookManager{client},
	}
}
