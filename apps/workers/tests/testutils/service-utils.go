package testutils

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/redis/redicluster"
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
	chainID string,
	chainUrl string,
	redisUrl string,
) (*etl.DataStreamer[blockstore.BlockDocument], error) {
	// Creates a redis client
	redisClient, err := GetRedisClient(t, redisUrl)
	if err != nil {
		return nil, err
	}

	// Creates a flow client
	flowClient, err := GetFlowClient(t, chainUrl)
	if err != nil {
		return nil, err
	}

	// Creates a block stream
	blockStream := streams.NewBlockStream(redisClient, chainID)

	// Creates the streamer
	return etl.NewDataStreamer(
		etlproducers.NewFlowBlockProducer(flowClient, nil, &etlproducers.FlowBlockProducerOpts{}),
		etlconsumers.NewBlockForwarder(blockStream),
	), nil
}

func NewEthBlockStreamer(
	t *testing.T,
	ctx context.Context,
	chainID string,
	chainUrl string,
	redisUrl string,
) (*etl.DataStreamer[blockstore.BlockDocument], error) {
	// Creates a redis client
	redisClient, err := GetRedisClient(t, redisUrl)
	if err != nil {
		return nil, err
	}

	// Creates an eth client
	ethClient, err := GetEthClient(t, chainUrl)
	if err != nil {
		return nil, err
	}

	// Creates a block stream
	blockStream := streams.NewBlockStream(redisClient, chainID)

	// Creates the streamer
	return etl.NewDataStreamer(
		etlproducers.NewEthBlockProducer(ethClient, nil),
		etlconsumers.NewBlockForwarder(blockStream),
	), nil
}

func NewRedisOptimizedBlockStore(
	t *testing.T,
	ctx context.Context,
	chainID string,
	redisUrl string,
	storeUrl string,
) (*blockstore.RedisOptimizedBlockStore, error) {
	// Creates a redis client
	redisClient, err := GetRedisClient(t, redisUrl)
	if err != nil {
		return nil, err
	}

	// Creates a postgres client
	pgClient, err := GetPostgresClient(t, ctx, storeUrl)
	if err != nil {
		return nil, err
	}

	// Creates the block store
	store := blockstore.NewRedisOptimizedBlockStore(
		blockstore.NewTimescaleBlockStore(pgClient),
		blockstore.NewRedisBlockStore(redisClient),
	)

	// Initializes the block store
	if err := store.Init(ctx, chainID); err != nil {
		return nil, err
	}

	// Returns the store
	return store, nil
}

func NewTimescaleBlockStore(
	t *testing.T,
	ctx context.Context,
	chainID string,
	storeUrl string,
) (*blockstore.TimescaleBlockStore, error) {
	// Creates a postgres client
	pgClient, err := GetPostgresClient(t, ctx, storeUrl)
	if err != nil {
		return nil, err
	}

	// Creates the block store
	store := blockstore.NewTimescaleBlockStore(pgClient)

	// Initializes the block store
	if err := store.Init(ctx, chainID); err != nil {
		return nil, err
	}

	// Returns the store
	return store, nil
}

func NewBlockStreamConsumer(
	t *testing.T,
	ctx context.Context,
	shardCount int,
	store blockstore.IBlockStore,
	chainID string,
	redisClusterUrl string,
	redisUrl string,
	opts *processing.BlockStreamConsumerOpts,
) (*processing.BlockStreamConsumer, error) {
	// Creates a redis client
	redisClient, err := GetRedisClient(t, redisUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis cluster client
	redisClusterClient, err := GetRedisClusterClient(t, redisClusterUrl)
	if err != nil {
		return nil, err
	}

	// Creates the webhook streams
	webhookStreams := make([]*streams.WebhookStream, shardCount)
	for shardNum := range shardCount {
		webhookStreams[shardNum] = streams.NewWebhookStream(redisClusterClient, shardNum)
	}

	// Creates the consumer
	return processing.NewBlockStreamConsumer(processing.BlockStreamConsumerParams{
		BlockStream:    streams.NewBlockStream(redisClient, chainID),
		RedisCluster:   redisClusterClient,
		WebhookStreams: webhookStreams,
		BlockStore:     store,
		Opts:           opts,
	}), nil
}

func NewWebhookStreamConsumer(
	t *testing.T,
	ctx context.Context,
	store blockstore.IBlockStore,
	redisClusterUrl string,
	shardNum int,
	opts *processing.WebhookStreamConsumerOpts,
) (*processing.WebhookStreamConsumer, error) {
	// Creates a redis client
	redisClusterClient, err := GetRedisClusterClient(t, redisClusterUrl)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return processing.NewWebhookStreamConsumer(processing.WebhookStreamConsumerParams{
		WebhookStream: streams.NewWebhookStream(redisClusterClient, shardNum),
		RedisCluster:  redicluster.NewRedisCluster(redisClusterClient),
		BlockStore:    store,
		Opts:          opts,
	}), nil
}
