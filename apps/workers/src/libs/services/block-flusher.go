package services

import (
	"block-feed/src/libs/constants"
	"block-feed/src/libs/messaging"
	"context"
	"errors"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

type (
	BlockFlusherOpts struct {
		BlockTimeoutMs int
	}

	BlockFlusherParams struct {
		WebhookStreamRedisClient *redis.Client
		BlockStreamRedisClient   *redis.Client
		Opts                     *BlockFlusherOpts
	}

	BlockFlusher struct {
		webhookStreamRedisClient *redis.Client
		blockStreamRedisClient   *redis.Client
		logger                   *log.Logger
		opts                     *BlockFlusherOpts
	}
)

// NOTE: a group of webhook processor replicas connected to a single redis instance need exactly one block flusher
func NewBlockFlusher(params BlockFlusherParams) *BlockFlusher {
	return &BlockFlusher{
		logger:                   log.New(os.Stdout, "[block-flusher] ", log.LstdFlags),
		webhookStreamRedisClient: params.WebhookStreamRedisClient,
		blockStreamRedisClient:   params.BlockStreamRedisClient,
		opts:                     params.Opts,
	}
}

func (service *BlockFlusher) Run(ctx context.Context) error {
	// Stores the last block height we flushed
	lastFlushedBlockHeight := uint64(0)

	// Stores the ID of the last stream message we processed
	cursorId := "0-0"

	// Processes the stream until the context is cancelled
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			// Fetches new elements from the stream (this will block if there's no elements with
			// an ID that is greater than the cursor ID). If we received new elements while we were
			// in the middle of processing the lua flushing script, then we should immediately try
			// to flush again with the latest stream entry (which holds the latest block height).
			streams, err := service.blockStreamRedisClient.XRead(ctx, &redis.XReadArgs{
				Streams: []string{constants.BLOCK_FLUSH_STREAM, cursorId},
				Block:   time.Duration(service.opts.BlockTimeoutMs) * time.Millisecond,
				Count:   1,
			}).Result()
			if err != nil {
				if errors.Is(err, redis.Nil) {
					// Timeout expired - no entries were found
					// Skip this iteration and wait again
					continue
				}
				return err
			}

			// Gets the message from the result
			msg, err := extractOneStreamMessage(streams, constants.BLOCK_FLUSH_STREAM)
			if err != nil {
				return err
			}

			// If the message is nil, loop again and wait for new messages
			if msg == nil {
				service.logger.Println("Block timeout expired, waiting again for new messages")
				continue
			} else {
				service.logger.Printf("Received message with ID \"%s\"\n", msg.ID)
			}

			// Gets an array of length 1 containing the last element added to the stream
			elems, err := service.blockStreamRedisClient.XRevRangeN(ctx, constants.BLOCK_FLUSH_STREAM, "+", "-", 1).Result()
			if err != nil {
				return err
			}

			// Extracts the last element of the stream (which is not necessarily the same as the
			// element we received from XREAD since new elements could have been added already).
			// This should not return an empty array since we've already checked that XREAD has
			// returned something, but we check this anyways and return an error if the last
			// element could not be obtained.
			var lastMsg redis.XMessage
			if len(elems) == 0 {
				return errors.New("could not obtain the last element added to the stream")
			} else {
				lastMsg = elems[0]
			}

			// Parses the last message
			parsedMsg, err := messaging.ParseMessage[messaging.BlockFlushStreamMsgData](lastMsg)
			if err != nil {
				return err
			}

			// If the block store is empty, ignore this message
			if parsedMsg.IsBlockStoreEmpty {
				cursorId = lastMsg.ID
				continue
			}

			// If we received new blocks, flushes any jobs interested in this new data
			if parsedMsg.LatestBlockHeight > lastFlushedBlockHeight {
				service.logger.Println("Block height lag detected - flushing pending jobs")
				if err := service.flush(ctx, parsedMsg.LatestBlockHeight); err != nil {
					return err
				} else {
					lastFlushedBlockHeight = parsedMsg.LatestBlockHeight
				}
			}

			// Updates the cursor ID
			cursorId = lastMsg.ID

			// Prints a success message
			service.logger.Printf("System is synced up to block %d", lastFlushedBlockHeight)
		}
	}
}

func (service *BlockFlusher) flush(ctx context.Context, latestBlockHeight uint64) error {
	// This script performs the following:
	//
	//  First, the latest block height passed to this function is used
	//  to update the old latest block height in redis.
	//
	//  Next, we get the element with the largest score in the pending
	//  set. Each element in the pending set is a webhook job that is
	//  waiting for new blocks. The score of each webhook job is the
	//  height of the last block that was sent to the webhook job's URL.
	//
	//  If the largest block height in the pending set is less than the
	//  largest block height that is in the block store, then this means
	//  new blocks are available for ALL the webhook jobs in the pending
	//  set, and they should all be moved back into the webhook processing
	//  stream.
	//
	//  If this is not the case, we only flush the elements with a block
	//  height that is smaller than the largest block height in the block
	//  store.
	//
	// This script is idempotent - running it again with the same inputs
	// will produce the same results.
	//
	flushScript := redis.NewScript(`
    local latest_block_height_key = KEYS[1]
    local pending_set_key = KEYS[2]
    local webhook_stream_key = KEYS[3]
    local webhook_stream_msg_data_field = KEYS[4]
    local latest_block_height = tonumber(ARGV[1])

    redis.call("SET", latest_block_height_key, latest_block_height)

    local max_elem = redis.call("ZRANGE", pending_set_key, -1, -1, "WITHSCORES")
    if #max_elem == 0 then
      return
    end

    if tonumber(max_elem[2]) < latest_block_height then
      while true do
        local elem = redis.call("ZPOPMIN", pending_set_key)
        if #elem ~= 2 then
          return
        else
          redis.call("XADD", webhook_stream_key, "*", webhook_stream_msg_data_field, elem[1])
        end
      end
    end

    while true do
      local elems = redis.call("ZRANGE", pending_set_key, 0, 0, "WITHSCORES")
      if #elems == 0 then
        return
      end

      if tonumber(elems[2]) >= latest_block_height then 
        return
      end

      redis.call("ZPOPMIN", pending_set_key)
      redis.call("XADD", webhook_stream_key, "*", webhook_stream_msg_data_field, elems[1])
    end
  `)

	// Executes the script
	if err := flushScript.Run(ctx,
		service.webhookStreamRedisClient,
		[]string{
			constants.LATEST_BLOCK_HEIGHT_KEY,
			constants.PENDING_SET_KEY,
			constants.WEBHOOK_STREAM,
			messaging.GetDataField(),
		},
		[]any{
			latestBlockHeight,
		},
	).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}
