package streaming

import (
	"block-feed/src/libs/messaging"
	"context"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

const (
	WebhookLoadBalancerStreamConsumerGroupName = "block-feed:webhook-load-balancer-stream-consumer"
	WebhookLoadBalancerStream                  = "block-feed:webhook-load-balancer-stream"
)

type (
	RedisWebhookLoadBalancerStream struct {
		redisClient *redis.Client
		logger      *log.Logger
	}
)

func NewRedisWebhookLoadBalancerStream(redisClient *redis.Client) *RedisWebhookLoadBalancerStream {
	return &RedisWebhookLoadBalancerStream{
		logger:      log.New(os.Stdout, "[webhook-lb-stream] ", log.LstdFlags),
		redisClient: redisClient,
	}
}

func (stream *RedisWebhookLoadBalancerStream) AddOne(
	ctx context.Context,
	msg *messaging.StreamMessage[messaging.WebhookLoadBalancerStreamMsgData],
) error {
	return addOne(
		ctx,
		stream.redisClient,
		WebhookLoadBalancerStream,
		msg,
	)
}

func (stream *RedisWebhookLoadBalancerStream) Subscribe(
	ctx context.Context,
	consumerName string,
	concurrency int,
	handler func(
		ctx context.Context,
		msgID string,
		msgData *messaging.WebhookLoadBalancerStreamMsgData,
		isBacklogMsg bool,
		metadata SubscribeMetadata,
	) error,
) error {
	return subscribe(
		ctx,
		stream.redisClient,
		stream.logger,
		WebhookLoadBalancerStream,
		WebhookLoadBalancerStreamConsumerGroupName,
		consumerName,
		concurrency,
		handler,
	)
}

func (stream *RedisWebhookLoadBalancerStream) Ack(
	ctx context.Context,
	msgID string,
) error {
	return xAckDel(
		ctx,
		stream.redisClient,
		WebhookLoadBalancerStream,
		WebhookLoadBalancerStreamConsumerGroupName,
		msgID,
	)
}
