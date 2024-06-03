package streams

import (
	"github.com/redis/go-redis/v9"
)

const (
	BlockStreamConsumerGroupName = "block-stream-consumer"
	BlockStreamName              = "block-stream"
)

type (
	BlockStreamMsgData struct {
		Block  []byte
		Height uint64
	}

	BlockStream struct {
		*RedisStream[BlockStreamMsgData]
		Chain string
	}
)

func NewBlockStreamMsg(height uint64, block []byte) *StreamMessage[BlockStreamMsgData] {
	return &StreamMessage[BlockStreamMsgData]{
		Data: BlockStreamMsgData{
			Height: height,
			Block:  block,
		},
	}
}

func NewBlockStream(client *redis.Client, chain string) *BlockStream {
	redisStream := NewRedisStream[BlockStreamMsgData](client, BlockStreamName, BlockStreamConsumerGroupName)
	return &BlockStream{
		redisStream,
		chain,
	}
}
