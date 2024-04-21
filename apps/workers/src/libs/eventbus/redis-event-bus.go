package eventbus

import (
	"block-feed/src/libs/messaging"
	"context"

	"github.com/redis/go-redis/v9"
)

type (
	RedisEventBus[T any] struct {
		redisClient *redis.Client
	}
)

func NewRedisEventBus[T any](redisClient *redis.Client) IEventBus[T] {
	return &RedisEventBus[T]{
		redisClient: redisClient,
	}
}

func (service *RedisEventBus[T]) Notify(
	ctx context.Context,
	channel string,
	msg *messaging.StreamMessage[T],
) error {
	data, err := msg.MarshalBinary()
	if err != nil {
		return err
	}

	return service.redisClient.XAdd(ctx, &redis.XAddArgs{
		ID:     "*",
		Stream: channel,
		MaxLen: 1,
		Values: map[string]any{messaging.GetDataField(): data},
	}).Err()
}

func (service *RedisEventBus[T]) Subscribe(
	ctx context.Context,
	channel string,
	handler func(msg *T) error,
) error {
	// Stores the ID of the last stream message we processed
	cursorId := "0-0"

	// Processes the stream until the context is cancelled
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			// Block until the stream has new elements with IDs greater than `cursorId`
			if _, err := service.redisClient.XRead(ctx, &redis.XReadArgs{
				Streams: []string{channel, cursorId},
				Block:   0,
				Count:   1,
			}).Result(); err != nil {
				return err
			}

			// If the stream has new elements, then we fetch the most recently added one
			// (which may not be the same as the one returned from XREAD since it only
			// fetches 1 element)
			elems, err := service.redisClient.XRevRangeN(ctx, channel, "+", "-", 1).Result()
			if err != nil {
				return err
			}

			// If we received a nonzero length array, then extract the stream element from
			// it, parse the element's data, and pass it to the handler for processing. If
			// processing is successful, update the cursor.
			if len(elems) != 0 {
				lastMsg := elems[0]

				data, err := messaging.ParseMessage[T](lastMsg)
				if err != nil {
					return err
				}

				err = handler(data)
				if err != nil {
					return err
				}

				cursorId = lastMsg.ID
			}
		}
	}
}
