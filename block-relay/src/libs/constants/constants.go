package constants

const (
	POSTGRES_BLOCK_CHANNEL_NAME    = "block-channel"
	RESCHEULER_CONSUMER_GROUP_NAME = "block-feed:webhook-rescheduler-consumer"
	WEBHOOK_CONSUMER_GROUP_NAME    = "block-feed:webhook-consumer"
	RESCHEDULER_STREAM             = "block-feed:webhook-rescheduler-stream"
	WEBHOOK_STREAM                 = "block-feed:webhook-stream"
	JOB_CURSOR_KEY                 = "block-feed:job-cursor"
)
