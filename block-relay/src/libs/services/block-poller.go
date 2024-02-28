package services

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/blockstore"
	"block-relay/src/libs/common"
	"block-relay/src/libs/constants"
	"block-relay/src/libs/messaging"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/errgroup"
)

type (
	BlockPollerOpts struct {
		MaxInFlightRequests int
		BlockTimeoutMs      int
		BatchSize           int
		PollMs              int
	}

	BlockPollerParams struct {
		RedisClient *redis.Client
		Chain       blockchains.IBlockchain
		Opts        BlockPollerOpts
	}

	BlockPoller struct {
		chain       blockchains.IBlockchain
		redisClient *redis.Client
		logger      *log.Logger
		opts        *BlockPollerOpts
	}
)

// NOTE: exactly one replica of this needs to be running per chain - adding more than one is unnecessary and will cause performance issues
func NewBlockPoller(params BlockPollerParams) *BlockPoller {
	return &BlockPoller{
		logger:      log.New(os.Stdout, fmt.Sprintf("[%s-block-poller] ", params.Chain.ID()), log.LstdFlags),
		redisClient: params.RedisClient,
		chain:       params.Chain,
		opts:        &params.Opts,
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
				if err := service.pushBlocks(ctx, blocks); err != nil {
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
		if err := service.pollBlocks(ctx, &lastProcessedBlockHeight, blockChan); err != nil {
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
				if err := service.pollBlocks(ctx, &lastProcessedBlockHeight, blockChan); err != nil {
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

func (service *BlockPoller) pollBlocks(ctx context.Context, lastProcessedBlockHeight **uint64, blockChan chan []blockstore.BlockDocument) error {
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
		return err
	}

	// Flushes all the blocks to the channel
	blockChan <- blocks

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

func (service *BlockPoller) pushBlocks(ctx context.Context, blocks []blockstore.BlockDocument) error {
	// JSON encodes the data
	data, err := messaging.NewBlockCacheStreamMsg(service.chain.ID(), blocks).MarshalBinary()
	if err != nil {
		return err
	}

	// Adds the data to the stream
	return service.redisClient.XAdd(ctx, &redis.XAddArgs{
		ID:     "*",
		Stream: constants.BLOCK_CACHE_STREAM,
		Values: map[string]any{messaging.GetDataField(): data},
	}).Err()
}

func (service *BlockPoller) getLastProcessedHeight(ctx context.Context) (*uint64, error) {
	// Gets the last element pushed to the block cache stream
	elems, err := service.redisClient.XRevRangeN(ctx, constants.BLOCK_CACHE_STREAM, "+", "-", 1).Result()
	if err != nil {
		return nil, err
	}

	// If we received an element back from the block cache stream, parse it and
	// return the latest processed height
	if len(elems) > 0 {
		parsedMsg, err := messaging.ParseMessage[messaging.BlockCacheStreamMsgData](elems[0])
		if err != nil {
			return nil, err
		} else {
			return &parsedMsg.Blocks[len(parsedMsg.Blocks)-1].Height, nil
		}
	}

	// If there's nothing in the block cache stream, then check the block
	// flush stream. If the block flush stream has nothing in it, wait for
	// the block cache processor to add something to it on startup. If the
	// block flush stream already has an element, use it to get the height.
	for {
		select {
		case <-ctx.Done():
			return nil, nil
		default:
			streams, err := service.redisClient.XRead(ctx, &redis.XReadArgs{
				Streams: []string{constants.BLOCK_FLUSH_STREAM, "0-0"},
				Block:   time.Duration(service.opts.BlockTimeoutMs) * time.Millisecond,
				Count:   1,
			}).Result()
			if err != nil {
				if errors.Is(err, redis.Nil) {
					// Timeout expired - no entries were found
					// Skip this iteration and wait again
					continue
				}
				return nil, err
			}

			// Gets the message from the result
			msg, err := extractOneStreamMessage(streams, constants.BLOCK_FLUSH_STREAM)
			if err != nil {
				return nil, err
			}

			// If the message is nil, loop again and wait
			if msg == nil {
				continue
			}

			// Parses the message
			parsedMsg, err := messaging.ParseMessage[messaging.BlockFlushStreamMsgData](*msg)
			if err != nil {
				return nil, err
			}

			// Returns nil if the block store is empty
			if parsedMsg.IsBlockStoreEmpty {
				return nil, nil
			}

			// Returns the latest block height
			return &parsedMsg.LatestBlockHeight, nil
		}
	}
}
