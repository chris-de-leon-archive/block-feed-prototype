package redistream

import "block-feed/src/libs/redis/redicluster"

type (
	ShardedRedisStream[T any] struct {
		*RedisStream[T]
		ShardNum int
	}
)

func NewShardedRedisStream[T any](
	client Streamable,
	name string,
	consumerGroupName string,
	shardNum int,
) *ShardedRedisStream[T] {
	redisStream := NewRedisStream[T](
		client,
		redicluster.GetStreamKey(shardNum, name),
		consumerGroupName,
	)

	return &ShardedRedisStream[T]{
		redisStream,
		shardNum,
	}
}
