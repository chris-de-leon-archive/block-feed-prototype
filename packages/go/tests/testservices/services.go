package testservices

import (
	"appenv"
	"blockforwarder"
	"blockrelay"
	blockhook "blockrelay"
	"blockrouter"
	"blockstore"
	"cachedstore"
	"context"
	"ethsrc"
	"flowsrc"
	"queries"
	"redistore"
	"streams"
	"testing"
	"testutils"
	"timescalestore"
)

func NewFlowBlockForwarder(
	t *testing.T,
	ctx context.Context,
	chainConfig appenv.ChainEnv,
) (*blockforwarder.BlockForwarder, error) {
	// Creates a flow client
	flowClient, err := testutils.GetFlowClient(t, chainConfig.ChainUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis client
	redisClient, err := testutils.GetRedisClient(t, chainConfig.RedisStreamUrl)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return blockforwarder.NewBlockForwarder(
		flowsrc.NewFlowBlockSource(flowClient, nil, &flowsrc.FlowBlockSourceOpts{}),
		streams.NewBlockStream(redisClient, chainConfig.ChainID),
	), nil
}

func NewEthBlockForwarder(
	t *testing.T,
	ctx context.Context,
	chainConfig appenv.ChainEnv,
) (*blockforwarder.BlockForwarder, error) {
	// Creates an eth client
	ethClient, err := testutils.GetEthClient(t, chainConfig.ChainUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis client
	redisClient, err := testutils.GetRedisClient(t, chainConfig.RedisStreamUrl)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return blockforwarder.NewBlockForwarder(
		ethsrc.NewEthBlockSource(ethClient, nil),
		streams.NewBlockStream(redisClient, chainConfig.ChainID),
	), nil
}

func NewRedisOptimizedBlockStore(
	t *testing.T,
	ctx context.Context,
	chainConfig appenv.ChainEnv,
) (*cachedstore.RedisOptimizedBlockStore, error) {
	// Creates a postgres client
	pgClient, err := testutils.GetPostgresClient(t, ctx, chainConfig.PgStoreUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis client
	redisClient, err := testutils.GetRedisClient(t, chainConfig.RedisStoreUrl)
	if err != nil {
		return nil, err
	}

	// Creates the block store
	store := cachedstore.NewRedisOptimizedBlockStore(
		timescalestore.NewTimescaleBlockStore(pgClient),
		redistore.NewRedisBlockStore(redisClient),
	)

	// Initializes the block store
	if err := store.Init(ctx, chainConfig.ChainID); err != nil {
		return nil, err
	}

	// Returns the store
	return store, nil
}

func NewBlockRouter(
	t *testing.T,
	ctx context.Context,
	chainConfig appenv.ChainEnv,
	store blockstore.IBlockStore,
	opts *blockrouter.BlockRouterOpts,
) (*blockrouter.BlockRouter, error) {
	// Creates a redis client
	redisClient, err := testutils.GetRedisClient(t, chainConfig.RedisStreamUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis cluster client
	redisClusterClient, err := testutils.GetRedisClusterClient(t, chainConfig.RedisClusterUrl)
	if err != nil {
		return nil, err
	}

	// Creates the webhook streams
	webhookStreams := make([]*streams.WebhookStream, chainConfig.ShardCount)
	for shardID := range chainConfig.ShardCount {
		webhookStreams[shardID] = streams.NewWebhookStream(redisClusterClient, shardID)
	}

	// Creates the consumer
	return blockrouter.NewBlockRouter(blockrouter.BlockRouterParams{
		BlockStream:    streams.NewBlockStream(redisClient, chainConfig.ChainID),
		WebhookStreams: webhookStreams,
		BlockStore:     store,
		Opts:           opts,
	}), nil
}

func NewBlockRelay(
	t *testing.T,
	ctx context.Context,
	chainConfig appenv.ChainEnv,
	store blockstore.IBlockStore,
	mySqlUrl string,
	mySqlConnPoolSize int,
	shardID int32,
	opts *blockrelay.BlockRelayOpts,
) (*blockrelay.BlockRelay, error) {
	// Creates a redis client
	redisClusterClient, err := testutils.GetRedisClusterClient(t, chainConfig.RedisClusterUrl)
	if err != nil {
		return nil, err
	}

	// Creates a mysql client
	mysqlClient, err := testutils.GetMySqlClient(t, mySqlUrl, mySqlConnPoolSize)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return blockrelay.NewBlockRelay(blockhook.BlockRelayParams{
		WebhookStream: streams.NewWebhookStream(redisClusterClient, shardID),
		Queries:       queries.New(mysqlClient),
		BlockStore:    store,
		Opts:          opts,
	}), nil
}
