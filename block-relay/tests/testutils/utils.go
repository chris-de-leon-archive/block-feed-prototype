package testutils

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/constants"
	"block-relay/src/libs/messaging"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type (
	RequestLog struct {
		Timestamp string
		Blocks    []string
	}
)

func SetupWebhook(
	ctx context.Context,
	t *testing.T,
	mysqlClient *sql.DB,
	chain blockchains.IBlockchain,
	redisURL string,
	serverURL string,
	webhookMaxBlocks int32,
	webhookMaxRetries int32,
	webhookTimeoutMs int32,
) error {
	// Creates a redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr:                  redisURL,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisClient.Close(); err != nil {
			t.Log(err)
		}
	}()

	// Starts a transaction
	tx, err := mysqlClient.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return err
	} else {
		defer func() {
			if err := tx.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
				t.Log(err)
			}
		}()
	}

	// Inserts a new customer
	customerId := uuid.New().String()
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO customer(id, created_at) VALUES (?, DEFAULT)`,
		customerId,
	); err != nil {
		return err
	}

	// Inserts a new webhook
	webhookId := uuid.New().String()
	if _, err := tx.ExecContext(ctx,
		`
     INSERT INTO webhook(id, created_at, url, max_blocks, max_retries, timeout_ms, customer_id, blockchain_id) 
     VALUES (?, DEFAULT, ?, ?, ?, ?, ?, ?)
    `,
		webhookId,
		serverURL,
		webhookMaxBlocks,
		webhookMaxRetries,
		webhookTimeoutMs,
		customerId,
		chain.ID(),
	); err != nil {
		return err
	}

	// Commits the transaction
	if err := tx.Commit(); err != nil {
		return err
	}

	// Activates the webhook
	if err := redisClient.ZAdd(ctx,
		constants.PENDING_SET_KEY,
		redis.Z{
			Score: 0,
			Member: messaging.NewWebhookStreamMsg(
				0,
				webhookId,
				true,
			),
		},
	).Err(); err != nil {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}

func SetupWebhooks(
	ctx context.Context,
	t *testing.T,
	dbClient *sql.DB,
	chain blockchains.IBlockchain,
	redisURL string,
	serverURLs []string,
	webhookMaxBlocks int32,
	webhookMaxRetries int32,
	webhookTimeoutMs int32,
) error {
	// Creates a redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr:                  redisURL,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisClient.Close(); err != nil {
			t.Log(err)
		}
	}()

	// Prepares for a batch insert
	const valCount = 7
	customerId := uuid.New().String()
	webhookIDs := make([]string, len(serverURLs))
	templates := make([]string, len(serverURLs))
	values := make([]any, valCount*len(serverURLs))
	for i, serverUrl := range serverURLs {
		webhookId := uuid.New().String()
		webhookIDs[i] = webhookId
		templates[i] = "(?, DEFAULT, ?, ?, ?, ?, ?, ?)"
		values[i*valCount+0] = webhookId
		values[i*valCount+1] = serverUrl
		values[i*valCount+2] = webhookMaxBlocks
		values[i*valCount+3] = webhookMaxRetries
		values[i*valCount+4] = webhookTimeoutMs
		values[i*valCount+5] = customerId
		values[i*valCount+6] = chain.ID()
	}

	// Starts a transaction
	tx, err := dbClient.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return err
	} else {
		defer func() {
			if err := tx.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
				t.Log(err)
			}
		}()
	}

	// Inserts a new customer
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO customer(id, created_at) VALUES (?, DEFAULT)`,
		customerId,
	); err != nil {
		return err
	}

	// Inserts the webhooks
	if _, err := tx.ExecContext(ctx,
		fmt.Sprintf(`
      INSERT INTO webhook(id, created_at, url, max_blocks, max_retries, timeout_ms, customer_id, blockchain_id) 
      VALUES %s
    `, strings.Join(templates, ",")),
		values...,
	); err != nil {
		return err
	}

	// Commits the transaction
	if err := tx.Commit(); err != nil {
		return err
	}

	// Prepares for bulk ZADD
	elems := make([]redis.Z, len(webhookIDs))
	for i, wid := range webhookIDs {
		elems[i] = redis.Z{
			Score: 0,
			Member: messaging.NewWebhookStreamMsg(
				0,
				wid,
				true,
			),
		}
	}

	// Activates the webhooks
	err = redisClient.ZAdd(ctx,
		constants.PENDING_SET_KEY,
		elems...,
	).Err()

	// Handles script errors
	if err != nil && !errors.Is(err, redis.Nil) {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}
