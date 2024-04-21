package etl

import (
	"block-feed/src/libs/blockchains"
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/common"
	"block-feed/src/libs/eventbus"
	"block-feed/src/libs/messaging"
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"golang.org/x/sync/errgroup"
)

type (
	BlockPollerOpts struct {
		ChannelName         string
		MaxInFlightRequests int
		BatchSize           int
		PollMs              int
	}

	BlockPollerParams struct {
		EventBus   eventbus.IEventBus[messaging.WebhookFlushStreamMsgData]
		BlockStore blockstore.IBlockStore
		Chain      blockchains.IBlockchain
		Opts       BlockPollerOpts
	}

	BlockPoller struct {
		eventBus   eventbus.IEventBus[messaging.WebhookFlushStreamMsgData]
		blockStore blockstore.IBlockStore
		chain      blockchains.IBlockchain
		logger     *log.Logger
		opts       *BlockPollerOpts
	}
)

// TODO: remove in future version
// NOTE: exactly one replica of this needs to be running per chain - adding more than one is unnecessary and will cause performance issues
func NewBlockPoller(params BlockPollerParams) *BlockPoller {
	return &BlockPoller{
		logger:     log.New(os.Stdout, fmt.Sprintf("[%s-block-poller] ", params.Chain.ID()), log.LstdFlags),
		blockStore: params.BlockStore,
		eventBus:   params.EventBus,
		chain:      params.Chain,
		opts:       &params.Opts,
	}
}

func (service *BlockPoller) Run(ctx context.Context) error {
	// Gets the last block height we processed - if lastProcessedBlockHeight is
	// still nil, then we'll query the blockchain for the latests block height
	lastProcessedBlockHeight, err := service.getLastProcessedHeight(ctx)
	if err != nil {
		return err
	}

	// Prints the last processed block height if it exists
	if lastProcessedBlockHeight == nil {
		service.logger.Printf("No blocks have been processed for chain %s", service.chain.ID())
	} else {
		service.logger.Printf("Latest block height is %d", *lastProcessedBlockHeight)
	}

	// Defines a channel for processing block heights
	blockChan := make(chan []blockstore.BlockDocument, 1)
	defer close(blockChan)

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
			case blocks, ok := <-blockChan:
				if !ok {
					return nil
				}
				if err := service.processBlocksFromChannel(ctx, blocks); err != nil {
					// High chance that this is a non-recoverable error
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
		if err := service.sendBlocksToChannel(ctx, &lastProcessedBlockHeight, blockChan); err != nil {
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
				if err := service.sendBlocksToChannel(ctx, &lastProcessedBlockHeight, blockChan); err != nil {
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

func (service *BlockPoller) processBlocksFromChannel(ctx context.Context, blocks []blockstore.BlockDocument) error {
	// Returns early if there are no blocks
	if len(blocks) == 0 {
		return nil
	}

	// Gets the block with the largest height
	latestBlock := blocks[0]

	// Stores the blocks
	if err := service.blockStore.PutBlocks(ctx, service.chain.ID(), blocks); err != nil {
		return err
	} else {
		service.logger.Printf("Successfully added %d block(s) to store (duplicate(s) ignored)", len(blocks))
	}

	// Notifies listeners that new blocks are available
	if err := service.eventBus.Notify(ctx, service.opts.ChannelName, messaging.NewWebhookFlushStreamMsg(latestBlock.Height)); err != nil {
		return err
	} else {
		service.logger.Printf("Successfully notified listeners of block %d", latestBlock.Height)
	}

	// Returns nil if no errors occurred
	return nil
}

func (service *BlockPoller) sendBlocksToChannel(ctx context.Context, lastProcessedBlockHeight **uint64, blockChan chan []blockstore.BlockDocument) error {
	// Stores the starting height of the block range we need to query
	var startHeight uint64

	// Fetches the latest block height
	latestBlock, err := service.chain.GetBlock(ctx, nil)
	if err != nil {
		return err
	} else {
		service.logger.Printf("Latest block height is %d\n", latestBlock.Height)
	}

	// If there's no last recorded block height for this chain, use the latest block
	// height from the chain. Otherwise, increment the last processed block height by
	// 1 ONLY IF this does not make it larger than the latest block height. If adding
	// by 1 makes the last processed block height larger than the latest block height,
	// then return early and wait for the next poll.
	if *lastProcessedBlockHeight == nil {
		service.logger.Printf("No block cursor exists for chain \"%s\" - using latest block height %d\n", service.chain.ID(), latestBlock.Height)
		startHeight = latestBlock.Height
	} else {
		service.logger.Printf("Last processed block height is %d\n", **lastProcessedBlockHeight)
		if (**lastProcessedBlockHeight + 1) > latestBlock.Height {
			service.logger.Printf("Next block height (%d) is larger than latest block height (%d) - waiting for next poll\n", **lastProcessedBlockHeight+1, latestBlock.Height)
			return nil
		} else {
			startHeight = **lastProcessedBlockHeight + 1
		}
	}

	// Calculates the inclusive end block height and sends them to the channel
	endHeight := min(startHeight+uint64(service.opts.BatchSize), latestBlock.Height)

	// Gets the blocks from the chain
	blocks, err := service.fetchBlocks(ctx, startHeight, endHeight)
	if err != nil {
		return err
	} else {
		blockChan <- blocks
	}

	// Logs a success message
	service.logger.Printf("Successfully scheduled %d block(s) for processing\n", len(blocks))

	// Updates the last processed height - it is important to do this AFTER
	// the full block range has been processed and no errors have occurred.
	// If we update the last processed height too early and run into an error
	// later in the function, then the last processed height will point to
	// a different block and the next poll won't try to re-process the same
	// failed block range
	if *lastProcessedBlockHeight == nil {
		*lastProcessedBlockHeight = new(uint64)
	}
	**lastProcessedBlockHeight = endHeight

	// Returns nil if there were no errors
	return nil
}

func (service *BlockPoller) fetchBlocks(ctx context.Context, startHeight uint64, endHeight uint64) ([]blockstore.BlockDocument, error) {
	// Creates an errgroup
	eg := new(errgroup.Group)
	eg.SetLimit(service.opts.MaxInFlightRequests)

	// Queries each block from the chain in parallel and adds them to a slice. The
	// slice should contain the blocks in descending order (e.g. blocks[0] should be
	// the block with the largest height and blocks[len(blocks)-1] should be the
	// block with the smallest height)
	blocks := make([]blockstore.BlockDocument, endHeight-startHeight+1)
	for h := startHeight; h <= endHeight; h++ {
		height := h
		eg.Go(func() error {
			// Gets the block from the chain
			b, err := service.chain.GetBlock(ctx, &height)
			if err != nil {
				return err
			} else {
				service.logger.Printf("Fetched block \"%d\"\n", b.Height)
			}

			// Adds the block to the slice
			blocks[endHeight-height] = blockstore.BlockDocument{
				Height: b.Height,
				Data:   b.Data,
			}

			// Returns nil if no errors occurred
			return nil
		})
	}

	// Waits for all the requests to finish and returns errors (if any)
	if err := eg.Wait(); err != nil {
		return []blockstore.BlockDocument{}, err
	} else {
		return blocks, nil
	}
}

func (service *BlockPoller) getLastProcessedHeight(ctx context.Context) (*uint64, error) {
	// Ensures that the block store is initialized
	err := service.blockStore.Init(ctx, service.chain.ID())
	if err != nil {
		return nil, err
	}

	// Gets the last block that was added to the blockstore
	lastProcessedBlock, err := service.blockStore.GetLatestBlock(ctx, service.chain.ID())
	if err != nil {
		return nil, err
	}

	// Returns nil if no blocks have been pushed to the blockstore yet
	if lastProcessedBlock == nil {
		return nil, nil
	} else {
		service.logger.Printf("Last processed block height is %d", lastProcessedBlock.Height)
	}

	// Notifies listeners that new blocks are available
	err = service.eventBus.Notify(ctx, service.opts.ChannelName, messaging.NewWebhookFlushStreamMsg(lastProcessedBlock.Height))
	if err != nil {
		return nil, err
	} else {
		service.logger.Printf("Successfully notified listeners of block %d", lastProcessedBlock.Height)
	}

	// Returns the last processed block height once listeners are notified
	return &lastProcessedBlock.Height, nil
}
