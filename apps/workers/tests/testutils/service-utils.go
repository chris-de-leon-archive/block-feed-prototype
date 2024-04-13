package testutils

import (
	"block-feed/src/libs/blockchains"
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/constants"
	"block-feed/src/libs/processors"
	"block-feed/src/libs/services"
	"context"
	"testing"
)

const DEFAULT_MYSQL_CONN_POOL_SIZE = 3

func NewBlockPoller(
	t *testing.T,
	redisUrl string,
	chain blockchains.IBlockchain,
	blockPollerOpts services.BlockPollerOpts,
) (*services.BlockPoller, error) {
	// Creates a redis client
	redisClient, err := GetRedisClient(t, redisUrl)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return services.NewBlockPoller(services.BlockPollerParams{
		RedisClient: redisClient,
		Chain:       chain,
		Opts:        blockPollerOpts,
	}), nil
}

func NewBlockFlusher(
	t *testing.T,
	webhookRedisUrl string,
	blockPollerRedisUrl string,
	blockFlusherOpts services.BlockFlusherOpts,
) (*services.BlockFlusher, error) {
	// Creates a client for the redis instance where webhook processing takes place
	webhookRedisClient, err := GetRedisClient(t, webhookRedisUrl)
	if err != nil {
		return nil, err
	}

	// Creates a client for the redis instance where where block processing takes place
	blockPollerRedisClient, err := GetRedisClient(t, blockPollerRedisUrl)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return services.NewBlockFlusher(services.BlockFlusherParams{
		WebhookStreamRedisClient: webhookRedisClient,
		BlockStreamRedisClient:   blockPollerRedisClient,
		Opts:                     &blockFlusherOpts,
	}), nil
}

func NewWebhookConsumer(
	t *testing.T,
	ctx context.Context,
	redisUrl string,
	mysqlUrl string,
	storeUrl string,
	streamConsumerOpts services.StreamConsumerOpts,
) (*services.StreamConsumer, error) {
	// Creates a redis client
	redisClient, err := GetRedisClient(t, redisUrl)
	if err != nil {
		return nil, err
	}

	// Creates a database connection pool
	mysqlClient, err := GetMySqlClient(t, mysqlUrl, DEFAULT_MYSQL_CONN_POOL_SIZE)
	if err != nil {
		return nil, err
	}

	// Creates a block store client
	blockStoreClient, err := GetPostgresClient(t, ctx, storeUrl)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisClient,
		Processor: processors.NewWebhookProcessor(processors.WebhookProcessorParams{
			BlockStore:  blockstore.NewTimescaleBlockStore(blockStoreClient),
			MySqlClient: mysqlClient,
			RedisClient: redisClient,
		}),
		Opts: &services.StreamConsumerOpts{
			StreamName:        constants.WEBHOOK_STREAM,
			ConsumerGroupName: constants.WEBHOOK_STREAM_CONSUMER_GROUP_NAME,
			ConsumerName:      streamConsumerOpts.ConsumerName,
			ConsumerPoolSize:  streamConsumerOpts.ConsumerPoolSize,
			BlockTimeoutMs:    streamConsumerOpts.BlockTimeoutMs,
		},
	}), nil
}

func NewBlockConsumer(
	t *testing.T,
	ctx context.Context,
	redisUrl string,
	storeUrl string,
	streamConsumerOpts services.StreamConsumerOpts,
	blockProcessorOpts processors.BlockProcessorOpts,
) (*services.StreamConsumer, error) {
	// Creates a redis client
	redisClient, err := GetRedisClient(t, redisUrl)
	if err != nil {
		return nil, err
	}

	// Creates a block store client
	blockStoreClient, err := GetPostgresClient(t, ctx, storeUrl)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisClient,
		Processor: processors.NewBlockProcessor(processors.BlockProcessorParams{
			BlockStore:  blockstore.NewTimescaleBlockStore(blockStoreClient),
			RedisClient: redisClient,
			Opts:        &blockProcessorOpts,
		}),
		Opts: &services.StreamConsumerOpts{
			StreamName:        constants.BLOCK_STREAM,
			ConsumerGroupName: constants.BLOCK_STREAM_CONSUMER_GROUP_NAME,
			ConsumerName:      streamConsumerOpts.ConsumerName,
			ConsumerPoolSize:  streamConsumerOpts.ConsumerPoolSize,
			BlockTimeoutMs:    streamConsumerOpts.BlockTimeoutMs,
		},
	}), nil
}

func NewWebhookLoadBalancerConsumer(
	t *testing.T,
	redisUrl string,
	mysqlUrl string,
	streamConsumerOpts services.StreamConsumerOpts,
	webhookLoadBalancerOpts processors.WebhookLoadBalancerProcessorOpts,
) (*services.StreamConsumer, error) {
	// Creates a redis client
	redisClient, err := GetRedisClient(t, redisUrl)
	if err != nil {
		return nil, err
	}

	// Creates a mysql client
	mysqlClient, err := GetMySqlClient(t, mysqlUrl, DEFAULT_MYSQL_CONN_POOL_SIZE)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisClient,
		Processor: processors.NewWebhookLoadBalancerProcessor(processors.WebhookLoadBalancerProcessorParams{
			MySqlClient: mysqlClient,
			RedisClient: redisClient,
			Opts:        &webhookLoadBalancerOpts,
		}),
		Opts: &services.StreamConsumerOpts{
			StreamName:        constants.WEBHOOK_LOAD_BALANCER_STREAM,
			ConsumerGroupName: constants.WEBHOOK_LOAD_BALANCER_STREAM_CONSUMER_GROUP_NAME,
			ConsumerName:      streamConsumerOpts.ConsumerName,
			ConsumerPoolSize:  streamConsumerOpts.ConsumerPoolSize,
			BlockTimeoutMs:    streamConsumerOpts.BlockTimeoutMs,
		},
	}), nil
}

func NewWebhookActivationConsumer(
	t *testing.T,
	redisUrl string,
	mysqlUrl string,
	streamConsumerOpts services.StreamConsumerOpts,
) (*services.StreamConsumer, error) {
	// Creates a redis client
	redisClient, err := GetRedisClient(t, redisUrl)
	if err != nil {
		return nil, err
	}

	// Creates a mysql client
	mysqlClient, err := GetMySqlClient(t, mysqlUrl, DEFAULT_MYSQL_CONN_POOL_SIZE)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisClient,
		Processor: processors.NewWebhookActivationProcessor(processors.WebhookActivationProcessorParams{
			MySqlClient: mysqlClient,
			RedisClient: redisClient,
		}),
		Opts: &services.StreamConsumerOpts{
			StreamName:        constants.WEBHOOK_ACTIVATION_STREAM,
			ConsumerGroupName: constants.WEBHOOK_ACTIVATION_STREAM_CONSUMER_GROUP_NAME,
			ConsumerName:      streamConsumerOpts.ConsumerName,
			ConsumerPoolSize:  streamConsumerOpts.ConsumerPoolSize,
			BlockTimeoutMs:    streamConsumerOpts.BlockTimeoutMs,
		},
	}), nil
}
