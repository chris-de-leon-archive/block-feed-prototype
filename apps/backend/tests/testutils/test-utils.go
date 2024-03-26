package testutils

import (
	"block-feed/src/libs/blockchains"
	"block-feed/src/libs/common"
	"block-feed/src/libs/constants"
	"block-feed/src/libs/messaging"
	"block-feed/src/libs/sqlc"
	"block-feed/tests/testqueries"
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type (
	RequestLog struct {
		Timestamp string
		Blocks    []string
	}
)

func LoadBalanceWebhook(
	ctx context.Context,
	t *testing.T,
	chain blockchains.IBlockchain,
	mysqlURL string,
	redisURL string,
	serverURL string,
	webhookMaxBlocks int32,
	webhookMaxRetries int32,
	webhookTimeoutMs int32,
	nodeURLs []string,
	numDuplicates int,
) error {
	// Prepares rows for a bulk insert
	nodes := make([]testqueries.CreateWebhookNodesParams, len(nodeURLs))
	for i, nodeUrl := range nodeURLs {
		nodes[i] = testqueries.CreateWebhookNodesParams{
			ID:           uuid.NewString(),
			CreatedAt:    time.Now().UTC(),
			Url:          nodeUrl,
			BlockchainID: chain.ID(),
		}
	}

	// Formats the rows for a bulk insert
	bulkNodeInsertQuery, bulkNodeInsertArgs := GetBulkInsertQuery("webhook_node", nodes)

	// Inserts fake data into the database
	webhookId, err := GetTempMySqlClient(mysqlURL, 1, func(client *sql.DB) (string, error) {
		// Starts a transaction
		tx, err := client.BeginTx(ctx, &sql.TxOptions{})
		if err != nil {
			return "", err
		} else {
			defer func() {
				if err := tx.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
					t.Log(err)
				}
			}()
		}

		// Binds the queries to the transaction
		testQtx := testqueries.New(tx)
		sqlcQtx := sqlc.New(tx)

		// Inserts a new customer
		customerId := uuid.NewString()
		if _, err := testQtx.CreateCustomer(ctx, customerId); err != nil {
			return "", err
		}

		// Makes sure the blockchain exists
		if _, err := sqlcQtx.UpsertBlockchain(ctx, &sqlc.UpsertBlockchainParams{
			ID:  chain.ID(),
			Url: chain.GetOpts().ChainUrl,
		}); err != nil {
			return "", err
		}

		// Inserts a new webhook
		webhookId := uuid.NewString()
		if _, err := testQtx.CreateWebhook(ctx, &testqueries.CreateWebhookParams{
			ID:           webhookId,
			CreatedAt:    time.Now().UTC(),
			IsActive:     false,
			IsQueued:     true,
			Url:          serverURL,
			MaxBlocks:    webhookMaxBlocks,
			MaxRetries:   webhookMaxRetries,
			TimeoutMs:    webhookTimeoutMs,
			CustomerID:   customerId,
			BlockchainID: chain.ID(),
		}); err != nil {
			return "", err
		}

		// Bulk inserts load balancer nodes
		if _, err := tx.ExecContext(ctx,
			bulkNodeInsertQuery,
			bulkNodeInsertArgs...,
		); err != nil {
			return "", err
		}

		// Commits the transaction
		if err := tx.Commit(); err != nil {
			return "", err
		}

		return webhookId, nil
	})
	if err != nil {
		return err
	}

	// Prepares for XADD
	data, err := messaging.NewWebhookLoadBalancerStreamMsg(webhookId).MarshalBinary()
	if err != nil {
		return err
	}

	// Activates the webhook
	return common.PickError(
		GetTempRedisClient(redisURL, func(client *redis.Client) (bool, error) {
			// TODO: lua script
			for i := 0; i < numDuplicates; i++ {
				if err := client.XAdd(ctx, &redis.XAddArgs{
					Stream: constants.WEBHOOK_LOAD_BALANCER_STREAM,
					ID:     "*",
					Values: map[string]any{messaging.GetDataField(): data},
				}).Err(); err != nil {
					return false, err
				}
			}
			return true, nil
		}),
	)
}

func SetupWebhook(
	ctx context.Context,
	t *testing.T,
	chain blockchains.IBlockchain,
	mysqlURL string,
	redisURL string,
	serverURL string,
	webhookMaxBlocks int32,
	webhookMaxRetries int32,
	webhookTimeoutMs int32,
) error {
	// Sets up the database with a webhook
	webhookId, err := GetTempMySqlClient(mysqlURL, 1, func(client *sql.DB) (string, error) {
		// Starts a transaction
		tx, err := client.BeginTx(ctx, &sql.TxOptions{})
		if err != nil {
			return "", err
		} else {
			defer func() {
				if err := tx.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
					t.Log(err)
				}
			}()
		}

		// Binds the queries to the transaction
		testQtx := testqueries.New(tx)
		sqlcQtx := sqlc.New(tx)

		// Inserts a new customer
		customerId := uuid.NewString()
		if _, err := testQtx.CreateCustomer(ctx, customerId); err != nil {
			return "", err
		}

		// Makes sure the blockchain exists
		if _, err := sqlcQtx.UpsertBlockchain(ctx, &sqlc.UpsertBlockchainParams{
			ID:  chain.ID(),
			Url: chain.GetOpts().ChainUrl,
		}); err != nil {
			return "", err
		}

		// Inserts a new webhook
		webhookId := uuid.NewString()
		if _, err := testQtx.CreateWebhook(ctx, &testqueries.CreateWebhookParams{
			ID:           webhookId,
			CreatedAt:    time.Now().UTC(),
			IsActive:     false,
			IsQueued:     true,
			Url:          serverURL,
			MaxBlocks:    webhookMaxBlocks,
			MaxRetries:   webhookMaxRetries,
			TimeoutMs:    webhookTimeoutMs,
			CustomerID:   customerId,
			BlockchainID: chain.ID(),
		}); err != nil {
			return "", err
		}

		// Commits the transaction
		if err := tx.Commit(); err != nil {
			return "", err
		}

		// Returns the webhook ID
		return webhookId, nil
	})
	if err != nil {
		return err
	}

	// Activates the webhook
	return common.PickError(
		GetTempRedisClient(redisURL, func(client *redis.Client) (int64, error) {
			return client.ZAdd(ctx,
				constants.PENDING_SET_KEY,
				redis.Z{
					Score: 0,
					Member: messaging.NewWebhookStreamMsg(
						0,
						webhookId,
						true,
					),
				},
			).Result()
		}),
	)
}

func SetupWebhooks(
	ctx context.Context,
	t *testing.T,
	chain blockchains.IBlockchain,
	redisURL string,
	mysqlURL string,
	serverURLs []string,
	webhookMaxBlocks int32,
	webhookMaxRetries int32,
	webhookTimeoutMs int32,
) error {
	// Generates a fake customer ID
	customerId := uuid.NewString()

	// Prepares rows for a bulk insert
	webhooks := make([]testqueries.CreateWebhookParams, len(serverURLs))
	for i, serverUrl := range serverURLs {
		webhooks[i] = testqueries.CreateWebhookParams{
			ID:           uuid.NewString(),
			CreatedAt:    time.Now().UTC(),
			IsActive:     false,
			IsQueued:     true,
			Url:          serverUrl,
			MaxBlocks:    webhookMaxBlocks,
			MaxRetries:   webhookMaxRetries,
			TimeoutMs:    webhookTimeoutMs,
			CustomerID:   customerId,
			BlockchainID: chain.ID(),
		}
	}

	// Formats the rows for a bulk insert
	bulkWebhookInsertQuery, bulkWebhookInsertArgs := GetBulkInsertQuery("webhook", webhooks)

	// Inserts fake data into the database
	if err := common.PickError(
		GetTempMySqlClient(mysqlURL, 1, func(client *sql.DB) (bool, error) {
			// Starts a transaction
			tx, err := client.BeginTx(ctx, &sql.TxOptions{})
			if err != nil {
				return false, err
			} else {
				defer func() {
					if err := tx.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
						t.Log(err)
					}
				}()
			}

			// Binds the queries to the transaction
			testQtx := testqueries.New(tx)
			sqlcQtx := sqlc.New(tx)

			// Inserts a new customer
			customerId := uuid.NewString()
			if _, err := testQtx.CreateCustomer(ctx, customerId); err != nil {
				return false, err
			}

			// Makes sure the blockchain exists
			if _, err := sqlcQtx.UpsertBlockchain(ctx, &sqlc.UpsertBlockchainParams{
				ID:  chain.ID(),
				Url: chain.GetOpts().ChainUrl,
			}); err != nil {
				return false, err
			}

			// Inserts the webhooks
			if _, err := tx.ExecContext(ctx,
				bulkWebhookInsertQuery,
				bulkWebhookInsertArgs...,
			); err != nil {
				return false, err
			}

			// Commits the transaction
			if err := tx.Commit(); err != nil {
				return false, err
			} else {
				return true, nil
			}
		}),
	); err != nil {
		return err
	}

	// Prepares for bulk ZADD
	elems := make([]redis.Z, len(webhooks))
	for i, w := range webhooks {
		elems[i] = redis.Z{
			Score: 0,
			Member: messaging.NewWebhookStreamMsg(
				0,
				w.ID,
				true,
			),
		}
	}

	// Activates the webhooks
	return common.PickError(
		GetTempRedisClient(redisURL, func(client *redis.Client) (int64, error) {
			return client.ZAdd(ctx,
				constants.PENDING_SET_KEY,
				elems...,
			).Result()
		}),
	)
}
