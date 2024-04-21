package testutils

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/eventbus"
	"block-feed/src/libs/messaging"
	"block-feed/src/libs/services/etl"
	etlconsumers "block-feed/src/libs/services/etl/consumers"
	etlproducers "block-feed/src/libs/services/etl/producers"
	"block-feed/src/libs/services/loadbalancing"
	"block-feed/src/libs/services/processing"
	"block-feed/src/libs/sqlc"
	"block-feed/src/libs/streaming"
	"context"
	"testing"
)

const DEFAULT_MYSQL_CONN_POOL_SIZE = 3

func NewFlowBlockStreamer(
	t *testing.T,
	ctx context.Context,
	chainID string,
	chainUrl string,
	redisUrl string,
	storeUrl string,
) (*etl.DataStreamer[blockstore.BlockDocument], error) {
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

	// Creates a flow client
	flowClient, err := GetFlowClient(t, chainUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis-backed event bus
	redisEventBus := eventbus.NewRedisEventBus[messaging.WebhookFlushStreamMsgData](redisClient)

	// Creates a timescaledb-backed blockstore
	timescaleBlockstore := blockstore.NewTimescaleBlockStore(blockStoreClient)

	// Initializes the blockstore
	if err := timescaleBlockstore.Init(ctx, chainID); err != nil {
		return nil, err
	}

	// Creates the streamer
	return etl.NewDataStreamer(
		etlproducers.NewFlowBlockProducer(
			flowClient,
			nil,
			&etlproducers.FlowBlockProducerOpts{},
		),
		etlconsumers.NewBlockStoreConsumer(chainID,
			timescaleBlockstore,
			redisEventBus,
		),
	), nil
}

func NewEthBlockStreamer(
	t *testing.T,
	ctx context.Context,
	chainID string,
	chainUrl string,
	redisUrl string,
	storeUrl string,
) (*etl.DataStreamer[blockstore.BlockDocument], error) {
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

	// Creates an eth client
	ethClient, err := GetEthClient(t, chainUrl)
	if err != nil {
		return nil, err
	}

	// Creates a redis-backed event bus
	redisEventBus := eventbus.NewRedisEventBus[messaging.WebhookFlushStreamMsgData](redisClient)

	// Creates a timescaledb-backed blockstore
	timescaleBlockstore := blockstore.NewTimescaleBlockStore(blockStoreClient)

	// Initializes the blockstore
	if err := timescaleBlockstore.Init(ctx, chainID); err != nil {
		return nil, err
	}

	// Creates the streamer
	return etl.NewDataStreamer(
		etlproducers.NewEthBlockProducer(
			ethClient,
			nil,
		),
		etlconsumers.NewBlockStoreConsumer(chainID,
			timescaleBlockstore,
			redisEventBus,
		),
	), nil
}

func NewWebhookFlusher(
	t *testing.T,
	webhookRedisUrl string,
	blockPollerRedisUrl string,
	opts processing.WebhookFlusherOpts,
) (*processing.WebhookFlusher, error) {
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
	return processing.NewWebhookFlusher(processing.WebhookFlusherParams{
		WebhookStream: streaming.NewRedisWebhookStream(webhookRedisClient),
		EventBus:      eventbus.NewRedisEventBus[messaging.WebhookFlushStreamMsgData](blockPollerRedisClient),
		Opts:          &opts,
	}), nil
}

func NewWebhookConsumer(
	t *testing.T,
	ctx context.Context,
	redisUrl string,
	mysqlUrl string,
	storeUrl string,
	opts *processing.WebhookConsumerOpts,
) (*processing.WebhookConsumer, error) {
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
	return processing.NewWebhookConsumer(processing.WebhookConsumerParams{
		BlockStore:      blockstore.NewTimescaleBlockStore(blockStoreClient),
		WebhookStream:   streaming.NewRedisWebhookStream(redisClient),
		DatabaseQueries: sqlc.New(mysqlClient),
		Opts:            opts,
	}), nil
}

func NewWebhookLoadBalancerConsumer(
	t *testing.T,
	redisUrl string,
	mysqlUrl string,
	opts *loadbalancing.WebhookLoadBalancerOpts,
) (*loadbalancing.WebhookLoadBalancer, error) {
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
	return loadbalancing.NewWebhookLoadBalancer(loadbalancing.WebhookLoadBalancerParams{
		WebhookLoadBalancerStream: streaming.NewRedisWebhookLoadBalancerStream(redisClient),
		MySqlClient:               mysqlClient,
		Opts:                      opts,
	}), nil
}

func NewWebhookActivationConsumer(
	t *testing.T,
	redisUrl string,
	mysqlUrl string,
	opts *processing.WebhookActivatorOpts,
) (*processing.WebhookActivator, error) {
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
	return processing.NewWebhookActivator(processing.WebhookActivatorParams{
		WebhookActivationStream: streaming.NewRedisWebhookActivationStream(redisClient),
		MySqlClient:             mysqlClient,
		Opts:                    opts,
	}), nil
}
