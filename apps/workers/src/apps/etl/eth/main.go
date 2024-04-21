package main

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"block-feed/src/libs/eventbus"
	"block-feed/src/libs/messaging"
	"block-feed/src/libs/services/etl"
	etlconsumers "block-feed/src/libs/services/etl/consumers"
	etlproducers "block-feed/src/libs/services/etl/producers"
	"context"
	"os/signal"
	"syscall"

	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	PostgresUrl   string `validate:"required,gt=0" env:"BLOCK_STREAMER_POSTGRES_URL,required"`
	RedisUrl      string `validate:"required,gt=0" env:"BLOCK_STREAMER_REDIS_URL,required"`
	BlockchainUrl string `validate:"required,gt=0" env:"BLOCK_STREAMER_BLOCKCHAIN_URL,required"`
	BlockchainId  string `validate:"required,gt=0" env:"BLOCK_STREAMER_BLOCKCHAIN_ID,required"`
}

func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Loads env variables into a struct and validates them
	envvars, err := config.LoadEnvVars[EnvVars]()
	if err != nil {
		panic(err)
	}

	// Creates a redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr:                  envvars.RedisUrl,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates a database connection pool
	pgClient, err := pgxpool.New(ctx, envvars.PostgresUrl)
	if err != nil {
		panic(err)
	}
	defer pgClient.Close()

	// Creates an eth client
	ethClient, err := ethclient.Dial(envvars.BlockchainUrl)
	if err != nil {
		panic(err)
	}
	defer ethClient.Close()

	// Creates a redis-backed event bus
	redisEventBus := eventbus.NewRedisEventBus[messaging.WebhookFlushStreamMsgData](redisClient)

	// Creates a timescaledb-backed blockstore
	timescaleBlockstore := blockstore.NewTimescaleBlockStore(pgClient)

	// Initializes the block store
	if err := timescaleBlockstore.Init(ctx, envvars.BlockchainId); err != nil {
		panic(err)
	}

	// Gets the last block that was added to the blockstore (if one exists)
	lastProcessedBlock, err := timescaleBlockstore.GetLatestBlock(ctx, envvars.BlockchainId)
	if err != nil {
		panic(err)
	}

	// If the blockstore has a last processed block, notify any listeners
	var startHeight *uint64 = nil
	if lastProcessedBlock != nil {
		startHeight = new(uint64)
		*startHeight = lastProcessedBlock.Height
		if err := redisEventBus.Notify(
			ctx,
			envvars.BlockchainId,
			messaging.NewWebhookFlushStreamMsg(lastProcessedBlock.Height),
		); err != nil {
			panic(err)
		}
	}

	// Creates the service
	service := etl.NewDataStreamer(
		etlproducers.NewEthBlockProducer(
			ethClient,
			startHeight,
		),
		etlconsumers.NewBlockStoreConsumer(envvars.BlockchainId,
			timescaleBlockstore,
			redisEventBus,
		),
	)

	// Runs the service until the context is cancelled
	if err = service.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
