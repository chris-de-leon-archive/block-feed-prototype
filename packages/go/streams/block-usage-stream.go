package streams

import (
	"github.com/redis/go-redis/v9"
)

const (
	BlockUsageStreamConsumerGroupName = "block-usage-stream-consumer"
	BlockUsageStreamName              = "block-usage-stream"
)

type (
	BlockUsageStreamMsgData struct {
		SubscriptionID string
	}

	BlockUsageStream struct {
		*RedisStream[BlockUsageStreamMsgData]
		Chain string
	}
)

func NewBlockUsageStreamMsg(subID string) *StreamMessage[BlockUsageStreamMsgData] {
	return &StreamMessage[BlockUsageStreamMsgData]{
		Data: BlockUsageStreamMsgData{
			SubscriptionID: subID,
		},
	}
}

func NewBlockUsageStream(client *redis.Client, chain string) *BlockUsageStream {
	redisStream := NewRedisStream[BlockUsageStreamMsgData](client, BlockUsageStreamName, BlockUsageStreamConsumerGroupName)
	return &BlockUsageStream{
		redisStream,
		chain,
	}
}
