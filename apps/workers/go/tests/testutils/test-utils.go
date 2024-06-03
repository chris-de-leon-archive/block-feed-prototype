package testutils

import (
	"block-feed/src/libs/apputils"
	"block-feed/src/libs/streams"
	"block-feed/tests/testutils/testqueries"
	"context"
	"database/sql"
	"errors"
	"math/rand/v2"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

func CreateManyWebhooks(
	count int,
	url string,
	maxBlocks int32,
	maxRetries int32,
	timeoutMs int32,
	customerID string,
	blockchainID string,
	totalShards int32,
) []testqueries.Webhook {
	webhooks := make([]testqueries.Webhook, count)
	for i := range count {
		webhooks[i] = testqueries.Webhook{
			ID:           uuid.NewString(),
			CreatedAt:    time.Now(),
			IsActive:     false,
			Url:          url,
			MaxBlocks:    maxBlocks,
			MaxRetries:   maxRetries,
			TimeoutMs:    timeoutMs,
			CustomerID:   customerID,
			BlockchainID: blockchainID,
			ShardID:      rand.Int32N(totalShards),
		}
	}
	return webhooks
}

func InsertManyWebhooks(
	ctx context.Context,
	mySqlUrl string,
	mySqlConnPoolSize int,
	customerID string,
	chainConfig apputils.ChainEnv,
	webhooks []testqueries.Webhook,
) error {
	// Reformat chainConfig
	blockchain := testqueries.Blockchain{
		ID:              chainConfig.ChainID,
		CreatedAt:       time.Now(),
		ShardCount:      chainConfig.ShardCount,
		Url:             chainConfig.ChainUrl,
		PgStoreUrl:      chainConfig.PgStoreUrl,
		RedisStoreUrl:   chainConfig.RedisStoreUrl,
		RedisClusterUrl: chainConfig.RedisClusterUrl,
		RedisStreamUrl:  chainConfig.RedisStreamUrl,
	}

	// Prepares for bulk insert
	blockchainsBulkInsertQuery, blockchainsBulkInsertArgs := GetBulkInsertQuery("blockchain", []testqueries.Blockchain{blockchain})
	webhooksBulkInsertQuery, webhooksBulkInsertArgs := GetBulkInsertQuery("webhook", webhooks)

	// Creates a customer and multiple webhooks
	if _, err := GetTempMySqlClient(mySqlUrl, mySqlConnPoolSize, func(client *sql.DB) (bool, error) {
		if err := WithTx(ctx, client, func(tx *sql.Tx) error {
			// Execute the following queries in a transaction
			qtx := testqueries.New(tx)

			// Inserts a customer
			if _, err := qtx.CustomersCreate(ctx, customerID); err != nil {
				return err
			}

			// Inserts the blockchain(s)
			if _, err := tx.ExecContext(ctx, blockchainsBulkInsertQuery, blockchainsBulkInsertArgs...); err != nil {
				return err
			}

			// Inserts the webhook(s)
			if _, err := tx.ExecContext(ctx, webhooksBulkInsertQuery, webhooksBulkInsertArgs...); err != nil {
				return err
			}

			// Returns nil if no errors occurred
			return nil
		},
			&sql.TxOptions{},
		); err != nil {
			return false, err
		} else {
			return true, nil
		}
	}); err != nil {
		return err
	} else {
		return nil
	}
}

func ActivateManyWebhooks(
	ctx context.Context,
	redisClusterUrl string,
	webhooks []testqueries.Webhook,
) error {
	shardIdToWebhookIDs := map[int32][]string{}
	for _, webhook := range webhooks {
		shardIdToWebhookIDs[webhook.ShardID] = append(shardIdToWebhookIDs[webhook.ShardID], webhook.ID)
	}

	// Script Breakdown:
	//
	// Keys:
	//   1 = key of webhook set
	//   2 = key of pending set
	//
	// ARGV:
	//   A list of webhook IDs
	//
	// Algorithm:
	//   1. First, we check which webhook IDs have already been activated and which ones haven't
	//   2. For all the webhooks that HAVE NOT been activated, we'll create a JSON job object for it and add the job to a lua table
	//   3. All input webhook IDs in ARGV are added to the webhook set (so that they cannot be activated again)
	//   4. The contents of the lua table containing the jobs is unpacked and added to the pending set for later processing
	//
	script := redis.NewScript(`
    local webhook_set_key = KEYS[1]
    local pending_set_key = KEYS[2]

    local exists = redis.call("SMISMEMBER", webhook_set_key, unpack(ARGV))
    
    local jobs = {}
    for i = 1, #ARGV do
      if exists[i] == 0 then 
        table.insert(jobs, 0)
        table.insert(jobs, 
          cjson.encode({ 
            ['WebhookID'] = ARGV[i], 
            ['BlockHeight'] = 0,
            ['IsNew'] = true,
          })
        )
      end
    end

    redis.call("SADD", webhook_set_key, unpack(ARGV))
    redis.call("ZADD", pending_set_key, unpack(jobs))
  `)

	if _, err := GetTempRedisClusterClient(redisClusterUrl, func(client *redis.ClusterClient) (bool, error) {
		for shardID, webhooksInShard := range shardIdToWebhookIDs {
			if err := script.Run(ctx, client,
				[]string{
					streams.GetWebhookSetKey(shardID),
					streams.GetPendingSetKey(shardID),
				},
				webhooksInShard,
			).Err(); err != nil && !errors.Is(err, redis.Nil) {
				return false, err
			}
		}
		return true, nil
	}); err != nil {
		return err
	} else {
		return nil
	}
}
