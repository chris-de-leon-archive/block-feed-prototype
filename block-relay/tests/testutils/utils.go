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
	dbClient *sql.DB,
	blockchainOpts blockchains.BlockchainOpts,
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

	// Gets a chain resolver (we only need this to get the latest block, so we can close this after this function executes)
	chainResolver := NewChainResolver()
	defer chainResolver.Close(func(err error) { fmt.Println(err) })

	// Gets the chain's RPC client
	chain, err := chainResolver.ResolveChain(&blockchainOpts)
	if err != nil {
		return err
	}

	// Gets the latest block on the chain
	block, err := chain.GetBlock(ctx, nil)
	if err != nil {
		return err
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
	if err := redisClient.XAdd(ctx, &redis.XAddArgs{
		Stream: constants.WEBHOOK_STREAM,
		Values: map[string]any{
			messaging.GetDataField(): messaging.NewWebhookMsg(
				chain.ID(),
				block.Height,
				webhookId,
				webhookMaxRetries,
			),
		},
	}).Err(); err != nil {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}

func SetupWebhooks(
	ctx context.Context,
	t *testing.T,
	dbClient *sql.DB,
	blockchainOpts blockchains.BlockchainOpts,
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

	// Gets a chain resolver (we only need this to get the latest block, so we can close this after this function executes)
	chainResolver := NewChainResolver()
	defer chainResolver.Close(func(err error) { fmt.Println(err) })

	// Gets the chain's RPC client
	chain, err := chainResolver.ResolveChain(&blockchainOpts)
	if err != nil {
		return err
	}

	// Gets the latest block on the chain
	block, err := chain.GetBlock(ctx, nil)
	if err != nil {
		return err
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
	customerId := uuid.New().String()
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO customer(id, created_at) VALUES (?, DEFAULT)`,
		customerId,
	); err != nil {
		return err
	}

	// Prepares for a batch insert
	const valCount = 7
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

	// Prepares for bulk XADD
	msgs := make([]any, len(webhookIDs))
	for i, wid := range webhookIDs {
		msgs[i] = messaging.NewWebhookMsg(
			chain.ID(),
			block.Height,
			wid,
			webhookMaxRetries,
		)
	}

	// Activates the webhooks
	bulkXAdd := redis.NewScript(`
    local stream_name = KEYS[1]
    local msg_data_field = KEYS[2]
    for i = 1, #ARGV do
      redis.call("XADD", stream_name, "*", msg_data_field, ARGV[i])
    end
  `)

	// Executes the script
	err = bulkXAdd.Run(ctx, redisClient,
		[]string{constants.WEBHOOK_STREAM, messaging.GetDataField()},
		msgs...,
	).Err()

	// Handles script errors
	if err != nil && !errors.Is(err, redis.Nil) {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}
