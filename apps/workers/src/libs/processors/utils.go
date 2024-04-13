package processors

import (
	"context"
	"errors"

	"github.com/redis/go-redis/v9"
)

func xAckDel(
	ctx context.Context,
	redisClient *redis.Client,
	streamName string,
	consumerGroupName string,
	msgID string,
) error {
	// Acknowledges the message and deletes it from the stream in one atomic operation
	xAckDelScript := redis.NewScript(`
      local stream_key = KEYS[1]
      local consumer_group_key = KEYS[2]
      local msg_id = KEYS[3]

      redis.call("XACK", stream_key, consumer_group_key, msg_id)
      redis.call("XDEL", stream_key, msg_id)
    `)

	// Executes the script
	if err := xAckDelScript.Run(ctx, redisClient,
		[]string{
			streamName,
			consumerGroupName,
			msgID,
		},
		[]any{},
	).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	} else {
		return nil
	}
}
