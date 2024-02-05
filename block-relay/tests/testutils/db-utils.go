package testutils

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/sqlc"
	"context"
	"fmt"
	"math"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func GetQueries(t *testing.T, ctx context.Context, dbUrl string) (*sqlc.Queries, error) {
	db, err := pgx.Connect(ctx, dbUrl)
	if err != nil {
		return nil, err
	}

	t.Cleanup(func() {
		if err := db.Close(ctx); err != nil {
			t.Log(err)
		}
	})

	return sqlc.New(db), nil
}

func SetupWebhook(
	ctx context.Context,
	queries *sqlc.Queries,
	blockchainOpts blockchains.BlockchainOpts,
	serverURL string,
	webhookMaxBlocks int32,
	webhookMaxRetries int32,
	webhookTimeoutMs int32,
) error {
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

	// Checks for overflow before casting
	if block.Height > math.MaxInt64 {
		return fmt.Errorf("cannot cast block height \"%d\" from a uint64 to an int64 without overflow", block.Height)
	}

	// Creates a dummy webhook subscription
	_, err = queries.CreateWebhook(ctx, &sqlc.CreateWebhookParams{
		LatestBlockHeight: int64(block.Height),
		Url:               serverURL,
		MaxBlocks:         webhookMaxBlocks,
		MaxRetries:        webhookMaxRetries,
		TimeoutMs:         webhookTimeoutMs,
		CustomerID:        uuid.New().String(),
		BlockchainID:      string(blockchainOpts.ChainID),
		BlockchainUrl:     blockchainOpts.ChainUrl,
	})
	if err != nil {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}
