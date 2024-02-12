package testutils

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/constants"
	"block-relay/src/libs/processors"
	"block-relay/src/libs/services"
	"block-relay/src/libs/sqlc"
	"context"
	"database/sql"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

func NewBlockPoller(
	t *testing.T,
	ctx context.Context,
	redisUrl string,
	dbUrl string,
	blockchainOpts blockchains.BlockchainOpts,
	blockPollerOpts services.BlockPollerOpts,
) (*services.BlockPoller, error) {
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

	// Creates a blockchain client
	resolver := NewChainResolver()
	t.Cleanup(func() { resolver.Close(func(err error) { t.Logf("error: %v\n", err) }) })
	chain, err := resolver.ResolveChain(&blockchainOpts)
	if err != nil {
		return nil, err
	}

	// Makes sure the blockchain exists in the database
	func() {
		db, err := sql.Open("mysql", dbUrl)
		if err != nil {
			panic(err)
		} else {
			defer db.Close()
			db.SetConnMaxLifetime(time.Duration(30) * time.Second)
			db.SetMaxOpenConns(1)
			db.SetMaxIdleConns(1)
		}

		if _, err := sqlc.New(db).UpsertBlockchain(ctx, &sqlc.UpsertBlockchainParams{
			ID:  chain.ID(),
			Url: chain.GetOpts().ChainUrl,
		}); err != nil {
			panic(err)
		}
	}()

	// Creates the service
	return services.NewBlockPoller(services.BlockPollerParams{
		RedisClient: redisClient,
		Chain:       chain,
		Opts:        blockPollerOpts,
	}), nil
}

func NewWebhookConsumer(
	t *testing.T,
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
	db, err := sql.Open("mysql", dbUrl)
	if err != nil {
		return nil, err
	} else {
		t.Cleanup(func() { db.Close() })
	}

	// Creates the service
	return services.NewStreamConsumer(services.StreamConsumerParams{
		RedisClient: redisClient,
		Processor: processors.NewWebhookProcessor(processors.WebhookProcessorParams{
			DatabaseClient: db,
			RedisClient:    redisClient,
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
