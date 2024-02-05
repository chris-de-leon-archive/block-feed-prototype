package services

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/common"
	"block-relay/src/libs/constants"
	"block-relay/src/libs/sqlc"
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/sync/errgroup"
)

type (
	BlockPollerOpts struct {
		Name                string
		MaxInFlightRequests int
		BatchSize           int
		PollMs              int
	}

	BlockPollerParams struct {
		DatabaseConnPool *pgxpool.Pool
		Chain            blockchains.IBlockchain
		Opts             BlockPollerOpts
	}

	BlockPoller struct {
		chain      blockchains.IBlockchain
		dbConnPool *pgxpool.Pool
		dbQueries  *sqlc.Queries
		logger     *log.Logger
		opts       *BlockPollerOpts
	}
)

// NOTE: only one instance of this needs to be running per chain - adding more than one is unnecessary and will cause performance issues
func NewBlockPoller(params BlockPollerParams) *BlockPoller {
	return &BlockPoller{
		logger:     log.New(os.Stdout, fmt.Sprintf("[%s-poller] ", params.Chain.ID()), log.LstdFlags),
		dbConnPool: params.DatabaseConnPool,
		dbQueries:  sqlc.New(params.DatabaseConnPool),
		chain:      params.Chain,
		opts:       &params.Opts,
	}
}

func (service *BlockPoller) Run(ctx context.Context) error {
	// Fetches info about the chain we're polling
	chainOpts := service.chain.GetOpts()

	// Registers the chain in the database if it doesn't already exist
	if _, err := service.dbQueries.UpsertBlockchain(ctx, &sqlc.UpsertBlockchainParams{
		ID:  string(chainOpts.ChainID),
		Url: chainOpts.ChainUrl,
	}); err != nil {
		return err
	}

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
		lastProcessedBlockHeight = new(uint64)
		*lastProcessedBlockHeight = uint64(blockCursor.BlockHeight)
	}

	// Defines a channel for processing block heights
	jobChan := make(chan []*sqlc.CacheBlocksParams)
	defer close(jobChan)

	// Creates an errgroup
	eg := new(errgroup.Group)

	// Creates a single background worker that processes items from the job channel in serial
	// It is important to do this sequentially - if multiple workers are tying to update the
	// same block cursor height then this could lead to block ranges being unnecessarily re-
	// queried and re-cached when this service is redeployed
	eg.Go(func() error {
		for {
			select {
			case <-ctx.Done():
				return nil
			case job, ok := <-jobChan:
				if !ok {
					return nil
				}
				if err := service.cacheBlocks(ctx, job); err != nil {
					// High chance that this is a non-recoverable database error
					return err
				}
			}
		}
	})

	// Creates a single background worker that adds new blocks to the job channel in serial
	// It is important to do this sequentially - if multiple pollers are online, they will
	// send duplicate blocks to the job channel which will put unnecessary load on the database
	eg.Go(func() error {
		// Logs a starting message
		service.logger.Printf("Listening for new blocks every %d millisecond(s)\n", service.opts.PollMs)

		// Processes a block immediately upon startup (if this is not here, then
		// the program will enter the for loop and wait unnecessarily for the poll
		// timeout to expire before processing a new block)
		if err := service.pollBlocks(ctx, &lastProcessedBlockHeight, jobChan); err != nil {
			// High chance this is a network error - no need to panic
			common.LogError(service.logger, err)
		}

		// Creates a timer
		timerDuration := time.Duration(service.opts.PollMs) * time.Millisecond
		timer := time.NewTimer(timerDuration)
		defer timer.Stop()

		// Repeatedly processes new blocks from the chain every PollMs milliseconds
		for {
			// Suppose instead of a timer we used a 2-second ticker but it takes 3+ seconds
			// to perform processing. If the ticker activates while data is being processed,
			// then we'll immediately process the data again, which is not what we want.
			// Instead, we want to fully wait another 2 seconds *from the time we finished
			// processing the last poll* before trying to process the data again. With that
			// in mind a timer would be more appropriate here.
			timer.Reset(timerDuration)

			// Continuously polls blocks until the context is cancelled
			select {
			case <-ctx.Done():
				return nil
			case _, ok := <-timer.C:
				if !ok {
					return nil
				}
				if err := service.pollBlocks(ctx, &lastProcessedBlockHeight, jobChan); err != nil {
					// High chance this is a network error - no need to panic
					common.LogError(service.logger, err)
				}
			}
		}
	})

	// Waits for the workers to come to a complete stop and returns any errors
	if err := eg.Wait(); err != nil {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}

func (service *BlockPoller) pollBlocks(ctx context.Context, lastProcessedBlockHeight **uint64, jobChan chan []*sqlc.CacheBlocksParams) error {
	// Stores the starting height of the block range we need to query
	var startHeight uint64

	// Fetches the latest block height
	latestBlock, err := service.chain.GetBlock(ctx, nil)
	if err != nil {
		return err
	} else {
		service.logger.Printf("Latest block height is %d\n", latestBlock.Height)
	}

	// If the database has no last recorded block height for this chain,
	// use the latest block height from the chain. Otherwise, increment
	// the last processed block height by 1 ONLY IF this does not make it
	// larger than the latest block height. If adding one makes the last
	// processed block height larger than the latest block height, then
	// return early and wait for the next poll.
	if *lastProcessedBlockHeight == nil {
		service.logger.Printf("No block cursor exists for chain \"%s\" - using latest block height %d\n", service.chain.ID(), latestBlock.Height)
		startHeight = latestBlock.Height
	} else {
		service.logger.Printf("Last processed block height is %d\n", **lastProcessedBlockHeight)
		if (**lastProcessedBlockHeight + 1) > latestBlock.Height {
			service.logger.Printf("Next block height (%d) is larger than latest block height (%d) - waiting for next poll\n", **lastProcessedBlockHeight+1, latestBlock.Height)
			return nil
		} else {
			service.logger.Println("New block detected")
			startHeight = **lastProcessedBlockHeight + 1
		}
	}

	// Calculates the inclusive end block height
	endHeight := min(startHeight+uint64(service.opts.BatchSize), latestBlock.Height)

	// Creates an errgroup
	eg := new(errgroup.Group)
	eg.SetLimit(service.opts.MaxInFlightRequests)

	// Queries each block from the chain in parallel and adds them to a slice. The
	// slice should contain the blocks in ascending order (e.g. blocks[0] should be
	// the block with the smallest height and blocks[len(blocks)-1] should be the
	// block with the largest height)
	blocks := make([]*sqlc.CacheBlocksParams, endHeight-startHeight+1)
	for h := startHeight; h <= endHeight; h++ {
		height := h
		eg.Go(func() error {
			b, err := service.chain.GetBlock(ctx, &height)
			if err != nil {
				return err
			}
			if b.Height > math.MaxInt64 {
				return fmt.Errorf("cannot cast block height \"%d\" from a uint64 to an int64 without overflow", b.Height)
			}
			blocks[endHeight-height] = &sqlc.CacheBlocksParams{
				BlockchainID: service.chain.ID(),
				BlockHeight:  int64(b.Height),
				Block:        b.Data,
			}
			return nil
		})
	}

	// Waits for all the requests to finish and returns errors (if any)
	if err := eg.Wait(); err != nil {
		return err
	}

	// Flushes all the blocks to the channel
	jobChan <- blocks

	// Logs a success message
	service.logger.Printf("Successfully scheduled %d block(s) for processing\n", len(blocks))

	// Updates the last processed height - it is important to do this AFTER
	// the full block range has been processed and no errors have occurred.
	// If we update the last processed height too early and run into an error
	// later in the function, then the last processed height will point to
	// a different block and next poll won't try to re-process the same failed
	// block range
	if *lastProcessedBlockHeight == nil {
		*lastProcessedBlockHeight = new(uint64)
	}
	**lastProcessedBlockHeight = endHeight

	// Returns nil if there were no errors
	return nil
}

func (service *BlockPoller) cacheBlocks(ctx context.Context, blocks []*sqlc.CacheBlocksParams) error {
	// Begins a transaction
	err := pgx.BeginFunc(ctx, service.dbConnPool, func(tx pgx.Tx) error {
		// Ensures that the following queries are run in the transaction
		qtx := service.dbQueries.WithTx(tx)

		// Updates the block cursor height
		if _, err := qtx.UpsertBlockCursor(ctx, &sqlc.UpsertBlockCursorParams{
			BlockchainID: service.chain.ID(),
			BlockHeight:  blocks[len(blocks)-1].BlockHeight,
			ID:           service.opts.Name,
		}); err != nil {
			return err
		}

		// Caches the blocks
		if _, err := qtx.CacheBlocks(ctx, blocks); err != nil {
			return err
		}

		// Sends a notification
		_, err := tx.Exec(ctx, `SELECT pg_notify(@channelName, '');`, pgx.NamedArgs{
			"channelName": constants.POSTGRES_BLOCK_CHANNEL_NAME,
		})
		if err != nil {
			return err
		}

		// Returns nil if no errors occurred
		return nil
	})

	// Handles any transaction errors
	if err != nil {
		return err
	} else {
		service.logger.Printf("Successfully cached block range: [%d, %d]\n", blocks[0].BlockHeight, blocks[len(blocks)-1].BlockHeight)
	}

	// Returns nil if no errors occurred
	return nil
}
