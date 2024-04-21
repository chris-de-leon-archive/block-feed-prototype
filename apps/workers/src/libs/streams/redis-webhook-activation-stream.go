package streams

import (
	"block-feed/src/libs/messaging"
	"context"
	"errors"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

const (
	WebhookActivationStreamConsumerGroupName = "block-feed:webhook-activation-stream-consumer"
	WebhookActivationStream                  = "block-feed:webhook-activation-stream"
)

type (
	RedisWebhookActivationStream struct {
		redisClient *redis.Client
		logger      *log.Logger
	}
)

func NewRedisWebhookActivationStream(redisClient *redis.Client) *RedisWebhookActivationStream {
	return &RedisWebhookActivationStream{
		logger:      log.New(os.Stdout, "[webhook-activation-stream] ", log.LstdFlags),
		redisClient: redisClient,
	}
}

func (stream *RedisWebhookActivationStream) AddOne(
	ctx context.Context,
	msg *messaging.StreamMessage[messaging.WebhookActivationStreamMsgData],
) error {
	return addOne(
		ctx,
		stream.redisClient,
		WebhookActivationStream,
		msg,
	)
}

func (stream *RedisWebhookActivationStream) Subscribe(
	ctx context.Context,
	consumerName string,
	concurrency int,
	handler func(
		ctx context.Context,
		msgID string,
		msgData *messaging.WebhookActivationStreamMsgData,
		isBacklogMsg bool,
		metadata SubscribeMetadata,
	) error,
) error {
	return subscribe(
		ctx,
		stream.redisClient,
		stream.logger,
		WebhookActivationStream,
		WebhookActivationStreamConsumerGroupName,
		consumerName,
		concurrency,
		handler,
	)
}

func (stream *RedisWebhookActivationStream) Ack(
	ctx context.Context,
	msgID string,
	webhookID *string,
) error {
	// Acknowledges the job and deletes it from the stream in one atomic operation
	// if the webhook should not be activated
	if webhookID == nil {
		return xAckDel(
			ctx,
			stream.redisClient,
			WebhookActivationStream,
			WebhookActivationStreamConsumerGroupName,
			msgID,
		)
	}

	// Acknowledges the job, deletes it from the stream, and adds it to the pending
	// set in one atomic operation
	ackScript := redis.NewScript(`
    local webhook_activation_stream_key = KEYS[1]
    local webhook_activation_stream_cg_key = KEYS[2]
    local webhook_activation_stream_msg_id = KEYS[3]
    local pending_set_key = KEYS[4]
    local pending_set_data = ARGV[1]

    redis.call("XACK", webhook_activation_stream_key, webhook_activation_stream_cg_key, webhook_activation_stream_msg_id)
    redis.call("XDEL", webhook_activation_stream_key, webhook_activation_stream_msg_id)
    redis.call("ZADD", pending_set_key, 0, pending_set_data)
  `)

	// Executes the script
	if err := ackScript.Run(ctx, stream.redisClient,
		[]string{
			WebhookActivationStream,
			WebhookActivationStreamConsumerGroupName,
			msgID,
			PendingSetKey,
		},
		[]any{
			messaging.NewWebhookStreamMsg(0, *webhookID, true),
		},
	).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	} else {
		return nil
	}
}
