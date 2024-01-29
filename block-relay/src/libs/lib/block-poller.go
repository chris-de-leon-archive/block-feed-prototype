package lib

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/common"
	"block-relay/src/libs/sqlc"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type (
	BlockPollerOpts struct {
		BatchSize int
		PollMs    int
	}

	BlockPollerParams struct {
		DatabaseConnPool *pgxpool.Pool
		Chain            blockchains.IBlockchain
		Opts             BlockPollerOpts
	}

	BlockPoller struct {
		logger     *log.Logger
		dbConnPool *pgxpool.Pool
		chain      blockchains.IBlockchain
		dbQueries  *sqlc.Queries
		opts       *BlockPollerOpts
	}

	BlockRange struct {
		From uint64
		To   uint64
	}
)

// NOTE: only one instance of this needs to be running per chain.
// Adding more than one poller for a single chain is unnecessary.
func NewBlockPoller(params BlockPollerParams) *BlockPoller {
	return &BlockPoller{
		logger:     log.New(os.Stdout, fmt.Sprintf("[%s-poller] ", params.Chain.ID()), log.LstdFlags),
		dbConnPool: params.DatabaseConnPool,
		chain:      params.Chain,
		dbQueries:  sqlc.New(params.DatabaseConnPool),
		opts:       &params.Opts,
	}
}

func (service *BlockPoller) Run(ctx context.Context) error {
	// Converts the chain ID to a string
	chainOpts := service.chain.GetOpts()

	// Stores the last recorded block height
	var lastProcessedBlockHeight *uint64 = nil

	// Fetches the last block height that was pushed to the database if one exists
	blockCursor, err := service.dbQueries.FindBlockCursor(ctx, service.chain.ID())
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	} else {
		service.logger.Println("Successfully queried DB for block cursor")
	}

	// If a block cursor exists for this chain, extract the last recorded block height
	if blockCursor != nil && !errors.Is(err, pgx.ErrNoRows) {
		height, err := strconv.ParseUint(blockCursor.BlockHeight, 10, 64)
		if err != nil {
			return err
		} else {
			lastProcessedBlockHeight = &height
		}
	}

	// Defines a channel for processing block heights
	jobChan := make(chan BlockRange)
	defer close(jobChan)

	// Creates a background worker that processes items from the job channel sequentially
	// We want to perserve the block ordering, so only one background worker is needed
	go func() {
		logger := log.New(os.Stdout, fmt.Sprintf("[%s-db-worker] ", service.chain.ID()), log.LstdFlags)
		for {
			select {
			case job, ok := <-jobChan:
				if !ok {
					return
				}
				if err := service.processBlockRange(ctx, chainOpts, logger, job); err != nil {
					common.LogError(logger, err)
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	// Logs a starting message
	service.logger.Printf("Listening for new blocks every %d millisecond(s)\n", service.opts.PollMs)

	// Processes a block immediately upon startup (if this is not here, then
	// the program will enter the for loop and unnecessarily wait for the poll
	// timeout to expire before processing a new block)
	if err := service.poll(ctx, &lastProcessedBlockHeight, jobChan); err != nil {
		common.LogError(service.logger, err)
	}

	// Sets up a timer for polling blocks
	timer := time.NewTimer(time.Duration(service.opts.PollMs) * time.Millisecond)
	defer timer.Stop()

	// Runs a loop that polls for new blocks until the context is done
	for {
		select {
		case _, ok := <-timer.C:
			if !ok {
				return nil
			}
			if err := service.poll(ctx, &lastProcessedBlockHeight, jobChan); err != nil {
				common.LogError(service.logger, err)
			}
		case <-ctx.Done():
			return nil
		}
	}
}

func (service *BlockPoller) poll(ctx context.Context, lastProcessedBlockHeight **uint64, jobChan chan BlockRange) error {
	// Fetches the latest block height
	latestBlockHeight, err := service.chain.GetLatestBlockHeight(ctx)
	if err != nil {
		return err
	} else {
		service.logger.Printf("Latest block height is %d\n", latestBlockHeight)
	}

	// If the database has no last recorded block height for this chain,
	// use the latest block height from the chain. Otherwise, increment
	// the last processed block height by 1 only if this does bot make it
	// larger than the latest block height. If it is larger, then return
	// early and wait for the next poll.
	if *lastProcessedBlockHeight == nil {
		service.logger.Printf("No block cursor exists for chain \"%s\" - using latest block height %d\n", service.chain.ID(), latestBlockHeight)
		*lastProcessedBlockHeight = &latestBlockHeight
	} else {
		service.logger.Printf("Last processed block height is %d\n", **lastProcessedBlockHeight)
		if (**lastProcessedBlockHeight + 1) > latestBlockHeight {
			service.logger.Printf("Next block height (%d) is larger than latest block height (%d) - waiting for next poll\n", **lastProcessedBlockHeight, latestBlockHeight)
			return nil
		} else {
			service.logger.Println("New block detected")
			**lastProcessedBlockHeight = **lastProcessedBlockHeight + 1
		}
	}

	// Sends the block range to the channel (ranges are inclusive)
	endHeight := min(**lastProcessedBlockHeight+uint64(service.opts.BatchSize), latestBlockHeight)
	jobChan <- BlockRange{
		From: **lastProcessedBlockHeight,
		To:   endHeight,
	}

	// Updates the last processed height
	**lastProcessedBlockHeight = endHeight

	// Logs a success message
	service.logger.Printf("Successfully scheduled block %d for processing\n", **lastProcessedBlockHeight)

	// Returns nil if there were no errors
	return nil
}

func (service *BlockPoller) processBlockRange(ctx context.Context, chainOpts *blockchains.BlockchainOpts, logger *log.Logger, blockRange BlockRange) error {
	// Loads the block range into a slice
	pendingJobs := make([]*sqlc.CreatePendingWebhookJobParams, blockRange.To-blockRange.From+1)
	for blockHeight := blockRange.From; blockHeight <= blockRange.To; blockHeight++ {
		pendingJobs[blockHeight-blockRange.From] = &sqlc.CreatePendingWebhookJobParams{
			ChainID:     service.chain.ID(),
			ChainUrl:    chainOpts.ChainUrl,
			BlockHeight: strconv.FormatUint(blockHeight, 10),
			ChannelName: POSTGRES_WEBHOOK_JOB_CHANNEL_NAME,
		}
	}

	// Starts a transaction to record the block height in the database
	tx, err := service.dbConnPool.Begin(ctx)
	if err != nil {
		return nil
	} else {
		defer func() {
			err := tx.Rollback(ctx)
			if err != nil && !errors.Is(err, pgx.ErrTxClosed) {
				common.LogError(logger, err)
			}
		}()
	}

	// Ensures that the following queries are run in a transaction
	qtx := service.dbQueries.WithTx(tx)

	// Records the block height in the database
	_, err = qtx.UpsertBlockCursor(ctx, &sqlc.UpsertBlockCursorParams{
		ID:          service.chain.ID(),
		BlockHeight: strconv.FormatUint(blockRange.To, 10),
	})
	if err != nil {
		return err
	}

	// Creates a batch of pending jobs
	_, err = qtx.CreatePendingWebhookJob(ctx, pendingJobs)
	if err != nil {
		return err
	}

	// Commits the transaction
	err = tx.Commit(ctx)
	if err != nil {
		return err
	} else {
		logger.Printf("Successfully processed block range: [%d, %d]\n", blockRange.From, blockRange.To)
	}

	// Returns nil if no errors occurred
	return nil
}
