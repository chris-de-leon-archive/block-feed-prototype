package streaming

import (
	"block-feed/src/libs/messaging"
	"context"
	"errors"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

const (
	WebhookStreamConsumerGroupName = "block-feed:webhook-stream-consumer"
	WebhookStream                  = "block-feed:webhook-stream"
	LatestBlockHeightKey           = "block-feed:latest-block-height"
	PendingSetKey                  = "block-feed:pending-set"
)

type (
	RedisWebhookStream struct {
		redisClient *redis.Client
		logger      *log.Logger
	}
)

func NewRedisWebhookStream(redisClient *redis.Client) *RedisWebhookStream {
	return &RedisWebhookStream{
		logger:      log.New(os.Stdout, "[webhook-stream] ", log.LstdFlags),
		redisClient: redisClient,
	}
}

func (stream *RedisWebhookStream) Subscribe(
	ctx context.Context,
	consumerName string,
	concurrency int,
	handler func(
		ctx context.Context,
		msgID string,
		msgData *messaging.WebhookStreamMsgData,
		isBacklogMsg bool,
		metadata SubscribeMetadata,
	) error,
) error {
	return subscribe(
		ctx,
		stream.redisClient,
		stream.logger,
		WebhookStream,
		WebhookStreamConsumerGroupName,
		consumerName,
		concurrency,
		handler,
	)
}

func (stream *RedisWebhookStream) GetPendingMsg(
	ctx context.Context,
	consumerName string,
	msgID string,
) (*redis.XPendingExt, error) {
	return getPendingMsg(
		ctx,
		stream.redisClient,
		WebhookStream,
		WebhookStreamConsumerGroupName,
		consumerName,
		msgID,
	)
}

func (stream *RedisWebhookStream) Ack(
	ctx context.Context,
	msgID string,
	newMsg *messaging.StreamMessage[messaging.WebhookStreamMsgData],
) error {
	// Acknowledges the job and deletes it from the stream in one atomic operation
	// if there is no new message to add
	if newMsg == nil {
		return xAckDel(
			ctx,
			stream.redisClient,
			WebhookStream,
			WebhookStreamConsumerGroupName,
			msgID,
		)
	}

	// Acknowledges the job, deletes it from the stream, and either reschedules
	// the job or adds it to the pending set in one atomic operation
	ackScript := redis.NewScript(`
    local latest_block_height_key = KEYS[1]
    local pending_set_key = KEYS[2]
    local webhook_stream_key = KEYS[3]
    local webhook_stream_cg_key = KEYS[4]
    local webhook_stream_msg_data_field = KEYS[5]
    local webhook_stream_old_msg_id = KEYS[6]
    local new_block_height = tonumber(ARGV[1])
    local webhook_stream_new_msg_data = ARGV[2]

    redis.call("XACK", webhook_stream_key, webhook_stream_cg_key, webhook_stream_old_msg_id)
    redis.call("XDEL", webhook_stream_key, webhook_stream_old_msg_id)

    local latest_block_height = redis.call("GET", latest_block_height_key)
    if latest_block_height == false then
      redis.call("ZADD", pending_set_key, new_block_height, webhook_stream_new_msg_data)
      return
    end

    if new_block_height >= tonumber(latest_block_height) then
      redis.call("ZADD", pending_set_key, new_block_height, webhook_stream_new_msg_data)
    else
      redis.call("XADD", webhook_stream_key, "*", webhook_stream_msg_data_field, webhook_stream_new_msg_data)
    end
  `)

	// Executes the script
	if err := ackScript.Run(ctx, stream.redisClient,
		[]string{
			LatestBlockHeightKey,
			PendingSetKey,
			WebhookStream,
			WebhookStreamConsumerGroupName,
			messaging.GetDataField(),
			msgID,
		},
		[]any{
			newMsg.Data.BlockHeight,
			newMsg,
		},
	).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	} else {
		return nil
	}
}

func (stream *RedisWebhookStream) Flush(ctx context.Context, latestBlockHeight uint64) error {
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
	// TODO: this script will always add webhooks with the smallest block
	// height to the stream first. It may be better to add them in a randomized
	// order to ensure fairness
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
		stream.redisClient,
		[]string{
			LatestBlockHeightKey,
			PendingSetKey,
			WebhookStream,
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
