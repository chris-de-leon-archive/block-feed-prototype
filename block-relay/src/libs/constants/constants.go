package constants

const (
	WEBHOOK_LOAD_BALANCER_STREAM_CONSUMER_GROUP_NAME = "block-feed:webhook-load-balancer-stream-consumer"
	WEBHOOK_LOAD_BALANCER_STREAM                     = "block-feed:webhook-load-balancer-stream"

	WEBHOOK_ACTIVATION_STREAM_CONSUMER_GROUP_NAME = "block-feed:webhook-activation-stream-consumer"
	WEBHOOK_ACTIVATION_STREAM                     = "block-feed:webhook-activation-stream"
	WEBHOOK_STREAM_CONSUMER_GROUP_NAME            = "block-feed:webhook-stream-consumer"
	WEBHOOK_STREAM                                = "block-feed:webhook-stream"
	LATEST_BLOCK_HEIGHT_KEY                       = "block-feed:latest-block-height"
	PENDING_SET_KEY                               = "block-feed:pending-set"

	BLOCK_CACHE_STREAM_CONSUMER_GROUP_NAME = "block-feed:block-cache-stream-consumer"
	BLOCK_CACHE_STREAM                     = "block-feed:block-cache-stream"
	BLOCK_FLUSH_STREAM                     = "block-feed:block-flush-stream"
)
