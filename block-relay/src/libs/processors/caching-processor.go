package processors

import (
	"block-relay/src/libs/blockstore"
	"block-relay/src/libs/constants"
	"block-relay/src/libs/messaging"
	"block-relay/src/libs/services"
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type (
	CachingProcessorOpts struct {
		ChainID string
	}

	CachingProcessorParams struct {
		BlockStore  blockstore.IBlockStore
		RedisClient *redis.Client
		Opts        *CachingProcessorOpts
	}

	CachingProcessor struct {
		blockStore  blockstore.IBlockStore
		redisClient *redis.Client
		opts        *CachingProcessorOpts
	}
)

// NOTE: exactly one replica of this service is needed
func NewCachingProcessor(params CachingProcessorParams) services.IStreamProcessor {
	return &CachingProcessor{
		redisClient: params.RedisClient,
		blockStore:  params.BlockStore,
		opts:        params.Opts,
	}
}

func (service *CachingProcessor) OnStartup(ctx context.Context, metadata services.OnStartupMetadata) error {
	// Validates the pool size
	if metadata.ConsumerPoolSize != 1 {
		return fmt.Errorf("consumer pool size must be 1 (got %d)", metadata.ConsumerPoolSize)
	}

	// Stores the message to send to the block flush stream on startup
	var msg *messaging.StreamMessage[messaging.BlockFlushStreamMsgData]

	// Initializes the block store
	if err := service.blockStore.Init(ctx, service.opts.ChainID); err != nil {
		return err
	}

	// Gets the last block we stored if one exists
	block, err := service.blockStore.GetLatestBlock(ctx, service.opts.ChainID)
	if err != nil {
		return err
	}

	// Builds a message for the block flush stream which will contain the last processed block's height
	if block == nil {
		// If we haven't processed any blocks yet, we'll indicate this in the message payload
		// and send it to the block flush stream
		msg = messaging.NewBlockFlushStreamMsg(
			service.opts.ChainID,
			0,
			true,
		)
	} else {
		// If we were able to get the latest block from the store, we'll extract its height
		// and send it to the block flush stream
		msg = messaging.NewBlockFlushStreamMsg(
			service.opts.ChainID,
			block.Height,
			false,
		)
	}

	// JSON encodes the data
	data, err := json.Marshal(msg.Data)
	if err != nil {
		return err
	}

	// Sends the latest block to the block flush stream immediately on startup
	// so that all block flusher nodes are up to date once this service starts
	return service.redisClient.XAdd(ctx, &redis.XAddArgs{
		Stream: constants.BLOCK_FLUSH_STREAM,
		MaxLen: 1,
		Approx: false,
		Values: map[string]any{messaging.GetDataField(): data},
	}).Err()
}

func (service *CachingProcessor) ProcessMessage(ctx context.Context, msg redis.XMessage, isBacklogMsg bool, metadata services.ProcessMessageMetadata) error {
	// Converts the incoming stream data to a strongly typed struct
	msgData, err := messaging.ParseMessage[messaging.BlockCacheStreamMsgData](msg)
	if err != nil {
		return err
	}

	// Makes sure we're processing messages for the correct chain
	if msgData.ChainID != service.opts.ChainID {
		return fmt.Errorf("expected message to have chain ID \"%s\" but received \"%s\"", service.opts.ChainID, msgData.ChainID)
	}

	// If there are no blocks, ACK this item and remove it from the stream
	if len(msgData.Blocks) == 0 {
		return service.ack(ctx, msg, nil, metadata)
	}

	// Stores the blocks
	if err := service.blockStore.PutBlocks(ctx, msgData.ChainID, msgData.Blocks); err != nil {
		return err
	} else {
		metadata.Logger.Printf("Successfully added %d block(s) to store (duplicate(s) ignored)", len(msgData.Blocks))
	}

	// If the program is terminated AFTER the message is processed but
	// BEFORE the message is fully acknowledged (i.e. right here in the
	// code), then the same blocks will be cached. However, this is okay
	// since blocks with duplicate heights are ignored. In other words,
	// this whole function is idempotent, so it will behave consistently
	// when it is restarted / redeployed.

	// Gets the block with the largest height (this assumes that the block
	// poller has already sorted the blocks in ascending order for us)
	latestBlockHeight := msgData.Blocks[len(msgData.Blocks)-1].Height

	// Marks this entry as completed
	return service.ack(ctx, msg,
		messaging.NewBlockFlushStreamMsg(
			msgData.ChainID,
			latestBlockHeight,
			false,
		),
		metadata,
	)
}

func (service *CachingProcessor) ack(ctx context.Context, msg redis.XMessage, newMsg *messaging.StreamMessage[messaging.BlockFlushStreamMsgData], metadata services.ProcessMessageMetadata) error {
	if newMsg == nil {
		// Acknowledges the job and deletes it from the stream in one atomic operation
		ackScript := redis.NewScript(`
      local block_cache_stream_key = KEYS[1]
      local block_cache_stream_cg_key = KEYS[2]
      local block_cache_stream_msg_id = KEYS[3]
      redis.call("XACK", block_cache_stream_key, block_cache_stream_cg_key, block_cache_stream_msg_id)
      redis.call("XDEL", block_cache_stream_key, block_cache_stream_msg_id)
    `)

		// Executes the script
		if err := ackScript.Run(ctx, service.redisClient,
			[]string{
				metadata.StreamName,
				metadata.ConsumerGroupName,
				msg.ID,
			},
			[]any{},
		).Err(); err != nil && !errors.Is(err, redis.Nil) {
			return err
		}
	} else {
		// Acknowledges the job, deletes it from the stream, and moves it to another stream in one atomic operation
		ackScript := redis.NewScript(`
      local block_cache_stream_key = KEYS[1]
      local block_cache_stream_cg_key = KEYS[2]
      local block_cache_stream_msg_id = KEYS[3]
      local block_flush_stream_key = KEYS[4]
      local block_flush_stream_msg_data_field = KEYS[5]
      local block_flush_stream_msg_data = ARGV[1]
      redis.call("XACK", block_cache_stream_key, block_cache_stream_cg_key, block_cache_stream_msg_id)
      redis.call("XDEL", block_cache_stream_key, block_cache_stream_msg_id)
      redis.call("XADD", block_flush_stream_key, "MAXLEN", "=", "1", "*", block_flush_stream_msg_data_field, block_flush_stream_msg_data)
    `)

		// Executes the script
		if err := ackScript.Run(ctx, service.redisClient,
			[]string{
				metadata.StreamName,
				metadata.ConsumerGroupName,
				msg.ID,
				constants.BLOCK_FLUSH_STREAM,
				messaging.GetDataField(),
			},
			[]any{newMsg},
		).Err(); err != nil && !errors.Is(err, redis.Nil) {
			return err
		}
	}

	// Returns nil if no errors occurred
	return nil
}
