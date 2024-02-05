package testutils

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/constants"
	"block-relay/src/libs/processors"
	"block-relay/src/libs/services"
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func NewBlockPoller(
	t *testing.T,
	ctx context.Context,
	dbUrl string,
	blockchainOpts blockchains.BlockchainOpts,
	blockPollerOpts services.BlockPollerOpts,
) (*services.BlockPoller, error) {
	// Creates a blockchain client
	resolver := NewChainResolver()
	t.Cleanup(func() { resolver.Close(func(err error) { t.Logf("error: %v\n", err) }) })
	chain, err := resolver.ResolveChain(&blockchainOpts)
	if err != nil {
		return nil, err
	}

	// Creates a database connection pool
	dbConnPool, err := pgxpool.New(ctx, dbUrl)
	if err != nil {
		return nil, err
	} else {
		t.Cleanup(func() { dbConnPool.Close() })
	}

	// Creates the service
	return services.NewBlockPoller(services.BlockPollerParams{
		DatabaseConnPool: dbConnPool,
		Chain:            chain,
		Opts:             blockPollerOpts,
	}), nil
}

func NewBlockReceiver(
	t *testing.T,
	ctx context.Context,
	redisUrl string,
	dbUrl string,
	blockReceiverOpts services.BlockReceiverOpts,
) (*services.BlockReceiver, error) {
	// Creates a redis client for streaming
	redisClient := redis.NewClient(&redis.Options{
		Addr:                  redisUrl,
		ContextTimeoutEnabled: true,
	})
	t.Cleanup(func() {
		if err := redisClient.Close(); err != nil {
			t.Log(err)
		}
	})

	// Creates a database connection pool
	dbConnPool, err := pgxpool.New(ctx, dbUrl)
	if err != nil {
		return nil, err
	} else {
		t.Cleanup(func() { dbConnPool.Close() })
	}

	// Creates the service
	return services.NewBlockReceiver(services.BlockReceiverParams{
		DatabaseConnPool: dbConnPool,
		RedisClient:      redisClient,
		Opts:             blockReceiverOpts,
	}), nil
}

func NewWebhookConsumer(
	t *testing.T,
	ctx context.Context,
	redisUrl string,
	dbUrl string,
	streamConsumerOpts services.StreamConsumerOpts,
	webhookProcessorOpts processors.WebhookProcessorOpts,
) (*services.StreamConsumer, error) {
	// Creates a redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr:                  redisUrl,
		ContextTimeoutEnabled: true,
	})
	t.Cleanup(func() {
		if err := redisClient.Close(); err != nil {
			t.Log(err)
		}
	})

	// Creates a database connection pool
	dbConnPool, err := pgxpool.New(ctx, dbUrl)
	if err != nil {
		return nil, err
	} else {
		t.Cleanup(func() { dbConnPool.Close() })
	}

	// Creates the service
	return services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisClient,
		Processor: processors.NewWebhookProcessor(processors.WebhookProcessorParams{
			DatabaseConnPool: dbConnPool,
			RedisClient:      redisClient,
			Opts:             &webhookProcessorOpts,
		}),
		Opts: &services.StreamConsumerOpts{
			StreamName:        constants.WEBHOOK_STREAM,
			ConsumerGroupName: constants.WEBHOOK_CONSUMER_GROUP_NAME,
			ConsumerName:      streamConsumerOpts.ConsumerName,
			MaxPoolSize:       streamConsumerOpts.MaxPoolSize,
			BlockTimeoutMs:    streamConsumerOpts.BlockTimeoutMs,
		},
	}), nil
}

func NewReschedulingConsumer(
	t *testing.T,
	ctx context.Context,
	redisUrl string,
	dbUrl string,
	streamConsumerOpts services.StreamConsumerOpts,
) (*services.StreamConsumer, error) {
	// Creates a redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr:                  redisUrl,
		ContextTimeoutEnabled: true,
	})
	t.Cleanup(func() {
		if err := redisClient.Close(); err != nil {
			t.Log(err)
		}
	})

	// Creates a database connection pool
	dbConnPool, err := pgxpool.New(ctx, dbUrl)
	if err != nil {
		return nil, err
	} else {
		t.Cleanup(func() { dbConnPool.Close() })
	}

	// Creates the service
	return services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisClient,
		Processor: processors.NewReschedulingProcessor(processors.ReschedulingProcessorParams{
			DatabaseConnPool: dbConnPool,
			RedisClient:      redisClient,
		}),
		Opts: &services.StreamConsumerOpts{
			StreamName:        constants.RESCHEDULER_STREAM,
			ConsumerGroupName: constants.RESCHEULER_CONSUMER_GROUP_NAME,
			ConsumerName:      streamConsumerOpts.ConsumerName,
			MaxPoolSize:       streamConsumerOpts.MaxPoolSize,
			BlockTimeoutMs:    streamConsumerOpts.BlockTimeoutMs,
		},
	}), nil
}
