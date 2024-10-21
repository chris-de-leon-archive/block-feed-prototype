package testservices

import (
	"context"
	"testing"

	"github.com/chris-de-leon/block-feed-prototype/appenv"
	"github.com/chris-de-leon/block-feed-prototype/block-sources/ethsrc"
	"github.com/chris-de-leon/block-feed-prototype/block-sources/flowsrc"
	"github.com/chris-de-leon/block-feed-prototype/block-stores/blockstore"
	"github.com/chris-de-leon/block-feed-prototype/block-stores/cachedstore"
	"github.com/chris-de-leon/block-feed-prototype/block-stores/redistore"
	"github.com/chris-de-leon/block-feed-prototype/block-stores/timescalestore"
	"github.com/chris-de-leon/block-feed-prototype/queries"
	"github.com/chris-de-leon/block-feed-prototype/services/blockforwarder"
	"github.com/chris-de-leon/block-feed-prototype/services/blockrelay"
	"github.com/chris-de-leon/block-feed-prototype/services/blockrouter"
	"github.com/chris-de-leon/block-feed-prototype/streams"
	"github.com/chris-de-leon/block-feed-prototype/testutils/clients/eth"
	"github.com/chris-de-leon/block-feed-prototype/testutils/clients/flow"
	"github.com/chris-de-leon/block-feed-prototype/testutils/clients/mysql"
	"github.com/chris-de-leon/block-feed-prototype/testutils/clients/pg"
	"github.com/chris-de-leon/block-feed-prototype/testutils/clients/redis"
)

func NewFlowBlockForwarder(
	t *testing.T,
	ctx context.Context,
	chainConfig appenv.ChainEnv,
) (*blockforwarder.BlockForwarder, error) {
	// Creates a flow client
	flowClient, err := flow.GetFlowClient(t, chainConfig.ChainUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis client
	redisClient, err := redis.GetRedisClient(t, chainConfig.RedisStreamUrl)
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
	ethClient, err := eth.GetEthClient(t, chainConfig.ChainUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis client
	redisClient, err := redis.GetRedisClient(t, chainConfig.RedisStreamUrl)
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
	pgClient, err := pg.GetPostgresClient(t, ctx, chainConfig.PgStoreUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis client
	redisClient, err := redis.GetRedisClient(t, chainConfig.RedisStoreUrl)
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
	redisClient, err := redis.GetRedisClient(t, chainConfig.RedisStreamUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis cluster client
	redisClusterClient, err := redis.GetRedisClusterClient(t, chainConfig.RedisClusterUrl)
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
	redisClusterClient, err := redis.GetRedisClusterClient(t, chainConfig.RedisClusterUrl)
	if err != nil {
		return nil, err
	}

	// Creates a mysql client
	mysqlClient, err := mysql.GetMySqlClient(t, mySqlUrl, mySqlConnPoolSize)
	if err != nil {
		return nil, err
	}

	// Creates the service
	return blockrelay.NewBlockRelay(blockrelay.BlockRelayParams{
		WebhookStream: streams.NewWebhookStream(redisClusterClient, shardID),
		Queries:       queries.New(mysqlClient),
		BlockStore:    store,
		Opts:          opts,
	}), nil
}
