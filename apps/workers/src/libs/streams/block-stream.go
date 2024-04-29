package streams

import (
	"block-feed/src/libs/messaging"
	"block-feed/src/libs/redis/redistream"

	"github.com/redis/go-redis/v9"
)

const (
	BlockStreamConsumerGroupName = "block-stream-consumer"
	BlockStreamName              = "block-stream"
)

type (
	BlockStream struct {
		*redistream.RedisStream[messaging.BlockStreamMsgData]
		Chain string
	}
)

func NewBlockStream(client *redis.Client, chain string) *BlockStream {
	redisStream := redistream.NewRedisStream[messaging.BlockStreamMsgData](client, BlockStreamName, BlockStreamConsumerGroupName)
	return &BlockStream{
		redisStream,
		chain,
	}
}
