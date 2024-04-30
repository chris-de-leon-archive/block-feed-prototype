package streams

import (
	"block-feed/src/libs/messaging"
	"block-feed/src/libs/redis/redicluster"
	"block-feed/src/libs/redis/redistream"
	"context"
	"errors"

	"github.com/redis/go-redis/v9"
)

const (
	WebhookStreamConsumerGroupName = "webhook-stream-consumer"
	WebhookStreamName              = "webhook-stream"
)

type (
	WebhookStream struct {
		*redistream.ShardedRedisStream[messaging.WebhookStreamMsgData]
		client *redis.ClusterClient
	}
)

func NewWebhookStream(client *redis.ClusterClient, shardNum int) *WebhookStream {
	redisStream := redistream.NewShardedRedisStream[messaging.WebhookStreamMsgData](client, WebhookStreamName, WebhookStreamConsumerGroupName, shardNum)
	return &WebhookStream{
		redisStream,
		client,
	}
}

func (stream *WebhookStream) Flush(
	ctx context.Context,
	height uint64,
) error {
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
	script := redis.NewScript(`
    local latest_block_height_key = KEYS[1]
    local pending_set_key = KEYS[2]
    local webhook_stream_key = KEYS[3]
    local webhook_stream_msg_data_field = ARGV[1]
    local latest_block_height = tonumber(ARGV[2])

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

	if err := script.Run(ctx, stream.client,
		[]string{
			redicluster.GetLatestBlockHeightKey(stream.ShardNum),
			redicluster.GetPendingSetKey(stream.ShardNum),
			stream.Name(),
		},
		[]any{
			messaging.GetDataField(),
			height,
		},
	).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	} else {
		return nil
	}
}

func (stream *WebhookStream) XAck(
	ctx context.Context,
	msgID string,
	newMsg *messaging.StreamMessage[messaging.WebhookStreamMsgData],
) error {
	// Acknowledges the job and deletes it from the stream in one atomic operation
	// if there is no new message to add
	if newMsg == nil {
		return stream.XAckDel(
			ctx,
			[]string{msgID},
		)
	}

	// Acknowledges the job, deletes it from the stream, and either reschedules
	// the job or adds it to the pending set in one atomic operation
	ackScript := redis.NewScript(`
    local latest_block_height_key = KEYS[1]
    local pending_set_key = KEYS[2]
    local webhook_stream_key = KEYS[3]
    local webhook_stream_cg = ARGV[1]
    local webhook_stream_msg_data_field = ARGV[2]
    local webhook_stream_old_msg_id = ARGV[3]
    local new_block_height = tonumber(ARGV[4])
    local webhook_stream_new_msg_data = ARGV[5]

    redis.call("XACK", webhook_stream_key, webhook_stream_cg, webhook_stream_old_msg_id)
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
	if err := ackScript.Run(ctx, stream.client,
		[]string{
			redicluster.GetLatestBlockHeightKey(stream.ShardNum),
			redicluster.GetPendingSetKey(stream.ShardNum),
			stream.Name(),
		},
		[]any{
			stream.ConsumerGroupName(),
			messaging.GetDataField(),
			msgID,
			newMsg.Data.BlockHeight,
			newMsg,
		},
	).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	} else {
		return nil
	}
}
