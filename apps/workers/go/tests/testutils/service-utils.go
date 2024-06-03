package testutils

import (
	"block-feed/src/libs/apputils"
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/queries"
	"block-feed/src/libs/services/etl"
	etlconsumers "block-feed/src/libs/services/etl/consumers"
	etlproducers "block-feed/src/libs/services/etl/producers"
	"block-feed/src/libs/services/processing"
	"block-feed/src/libs/streams"
	"context"
	"testing"
)

func NewFlowBlockStreamer(
	t *testing.T,
	ctx context.Context,
	chainConfig apputils.ChainEnv,
) (*etl.DataStreamer[blockstore.BlockDocument], error) {
	// Creates a flow client
	flowClient, err := GetFlowClient(t, chainConfig.ChainUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis client
	redisClient, err := GetRedisClient(t, chainConfig.RedisStreamUrl)
	if err != nil {
		return nil, err
	}

	// Creates a block stream
	blockStream := streams.NewBlockStream(redisClient, chainConfig.ChainID)

	// Creates the streamer
	return etl.NewDataStreamer(
		etlproducers.NewFlowBlockProducer(flowClient, nil, &etlproducers.FlowBlockProducerOpts{}),
		etlconsumers.NewBlockForwarder(blockStream),
	), nil
}

func NewEthBlockStreamer(
	t *testing.T,
	ctx context.Context,
	chainConfig apputils.ChainEnv,
) (*etl.DataStreamer[blockstore.BlockDocument], error) {
	// Creates an eth client
	ethClient, err := GetEthClient(t, chainConfig.ChainUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis client
	redisClient, err := GetRedisClient(t, chainConfig.RedisStreamUrl)
	if err != nil {
		return nil, err
	}

	// Creates a block stream
	blockStream := streams.NewBlockStream(redisClient, chainConfig.ChainID)

	// Creates the streamer
	return etl.NewDataStreamer(
		etlproducers.NewEthBlockProducer(ethClient, nil),
		etlconsumers.NewBlockForwarder(blockStream),
	), nil
}

func NewRedisOptimizedBlockStore(
	t *testing.T,
	ctx context.Context,
	chainConfig apputils.ChainEnv,
) (*blockstore.RedisOptimizedBlockStore, error) {
	// Creates a postgres client
	pgClient, err := GetPostgresClient(t, ctx, chainConfig.PgStoreUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis client
	redisClient, err := GetRedisClient(t, chainConfig.RedisStoreUrl)
	if err != nil {
		return nil, err
	}

	// Creates the block store
	store := blockstore.NewRedisOptimizedBlockStore(
		blockstore.NewTimescaleBlockStore(pgClient),
		blockstore.NewRedisBlockStore(redisClient),
	)

	// Initializes the block store
	if err := store.Init(ctx, chainConfig.ChainID); err != nil {
		return nil, err
	}

	// Returns the store
	return store, nil
}

func NewBlockStreamConsumer(
	t *testing.T,
	ctx context.Context,
	chainConfig apputils.ChainEnv,
	store blockstore.IBlockStore,
	opts *processing.BlockStreamConsumerOpts,
) (*processing.BlockStreamConsumer, error) {
	// Creates a redis client
	redisClient, err := GetRedisClient(t, chainConfig.RedisStreamUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis cluster client
	redisClusterClient, err := GetRedisClusterClient(t, chainConfig.RedisClusterUrl)
	if err != nil {
		return nil, err
	}

	// Creates the webhook streams
	webhookStreams := make([]*streams.WebhookStream, chainConfig.ShardCount)
	for shardID := range chainConfig.ShardCount {
		webhookStreams[shardID] = streams.NewWebhookStream(redisClusterClient, shardID)
	}

	// Creates the consumer
	return processing.NewBlockStreamConsumer(processing.BlockStreamConsumerParams{
		BlockStream:    streams.NewBlockStream(redisClient, chainConfig.ChainID),
		WebhookStreams: webhookStreams,
		BlockStore:     store,
		Opts:           opts,
	}), nil
}

func NewWebhookStreamConsumer(
	t *testing.T,
	ctx context.Context,
	chainConfig apputils.ChainEnv,
	store blockstore.IBlockStore,
	mySqlUrl string,
	mySqlConnPoolSize int,
	shardID int32,
	opts *processing.WebhookStreamConsumerOpts,
) (*processing.WebhookStreamConsumer, error) {
	// Creates a redis client
	redisClusterClient, err := GetRedisClusterClient(t, chainConfig.RedisClusterUrl)
	if err != nil {
		return nil, err
	}

	// Creates a mysql client
	mysqlClient, err := GetMySqlClient(t, mySqlUrl, mySqlConnPoolSize)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return processing.NewWebhookStreamConsumer(processing.WebhookStreamConsumerParams{
		WebhookStream: streams.NewWebhookStream(redisClusterClient, shardID),
		Queries:       queries.New(mysqlClient),
		BlockStore:    store,
		Opts:          opts,
	}), nil
}
