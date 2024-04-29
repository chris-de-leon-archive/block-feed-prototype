package integration

import (
	"block-feed/src/libs/redis/redicluster"
	"block-feed/tests/testutils"
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestRediClusterWebhookManager(t *testing.T) {
	// Defines helper variables
	ctx := context.Background()
	webhook := redicluster.Webhook{
		ID:           uuid.NewString(),
		URL:          "http://localhost:3000",
		BlockchainID: "flow-testnet",
		MaxRetries:   5,
		MaxBlocks:    10,
		TimeoutMs:    5000,
	}

	// Starts a redis cluster
	cRedisCluster, err := testutils.NewRedisClusterContainer(ctx, t, testutils.REDIS_CLUSTER_MIN_NODES)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a redis cluster client
	client, err := testutils.GetRedisClusterClient(t, cRedisCluster.Conn.Url)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a wrapper around the client
	cluster := redicluster.NewRedisCluster(client)

	// Inserts a webhook
	t.Run("Inserts a webhook", func(t *testing.T) {
		if err := cluster.Webhooks.Set(ctx, 1, webhook); err != nil {
			t.Fatal(err)
		}

		data, err := cluster.Webhooks.Get(ctx, 1, webhook.ID)
		if err != nil {
			t.Fatal(err)
		}
		if data == nil {
			t.Fatal("The webhook does not exist")
		}
		if data.ID != webhook.ID {
			t.Fatalf("The incorrect webhook was retrieved")
		}
	})

	// Updates the webhook
	t.Run("Updates the webhook", func(t *testing.T) {
		webhook.MaxRetries = 10
		if err := cluster.Webhooks.Set(ctx, 1, webhook); err != nil {
			t.Fatal(err)
		}

		data, err := cluster.Webhooks.Get(ctx, 1, webhook.ID)
		if err != nil {
			t.Fatal(err)
		}
		if data == nil {
			t.Fatal("The webhook does not exist")
		}
		if data.ID != webhook.ID {
			t.Fatalf("The incorrect webhook was retrieved")
		}
		if data.MaxRetries != webhook.MaxRetries {
			t.Fatalf("The webhook was not updated")
		}
	})

	// Deletes the webhook
	t.Run("Deletes the webhook", func(t *testing.T) {
		if err := cluster.Webhooks.Del(ctx, 1, webhook.ID); err != nil {
			t.Fatal(err)
		}

		data, err := cluster.Webhooks.Get(ctx, 1, webhook.ID)
		if err != nil {
			t.Fatal(err)
		}
		if data != nil {
			t.Fatal("The webhook was not deleted")
		}
	})
}
