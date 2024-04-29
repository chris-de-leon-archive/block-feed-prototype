package redicluster

import (
	"block-feed/src/libs/messaging"
	"context"
	"encoding/json"
	"errors"

	"github.com/redis/go-redis/v9"
)

type WebhookManager struct {
	client *redis.ClusterClient
}

// TODO: put a GraphQL API in front of this
func (mgr *WebhookManager) Get(ctx context.Context, shardNum int, webhookID string) (*Webhook, error) {
	result, err := mgr.client.Get(ctx, GetWebhookKey(shardNum, webhookID)).Result()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var webhook Webhook
	if err := json.Unmarshal([]byte(result), &webhook); err != nil {
		return nil, err
	}

	return &webhook, nil
}

func (mgr *WebhookManager) Set(ctx context.Context, shardNum int, webhook Webhook) error {
	webhookData, err := json.Marshal(webhook)
	if err != nil {
		return err
	}

	// If the webhook does not already exist, insert it and add
	// it to the pending set. Otherwise, update the webhook.
	script := redis.NewScript(`
    local pending_set_key = KEYS[2]
    local pending_set_val = ARGV[2]
    local key = KEYS[1]
    local val = ARGV[1]

    local result = redis.call("SET", key, val, "GET")
    if result == false then
      redis.call("ZADD", pending_set_key, 0, pending_set_val)
    end
  `)

	if err := script.Run(ctx, mgr.client,
		[]string{
			GetWebhookKey(shardNum, webhook.ID),
			GetPendingSetKey(shardNum),
		},
		[]any{
			webhookData,
			messaging.NewWebhookStreamMsg(webhook.ID, 0, true),
		},
	).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	} else {
		return nil
	}
}

func (mgr *WebhookManager) Del(ctx context.Context, shardNum int, webhookID string) error {
	err := mgr.client.Del(ctx, GetWebhookKey(shardNum, webhookID)).Err()
	if errors.Is(err, redis.Nil) {
		return nil
	}
	if err != nil {
		return err
	}
	return nil
}
