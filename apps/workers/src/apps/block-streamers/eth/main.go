package main

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/common"
	"block-feed/src/libs/config"
	"block-feed/src/libs/services/etl"
	etlconsumers "block-feed/src/libs/services/etl/consumers"
	etlproducers "block-feed/src/libs/services/etl/producers"
	"block-feed/src/libs/streams"
	"context"
	"os/signal"
	"syscall"

	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	PostgresUrl    string `validate:"required,gt=0" env:"BLOCK_STREAMER_POSTGRES_URL,required"`
	RedisStreamUrl string `validate:"required,gt=0" env:"BLOCK_STREAMER_REDIS_STREAM_URL,required"`
	RedisStoreUrl  string `validate:"required,gt=0" env:"BLOCK_STREAMER_REDIS_STORE_URL,required"`
	ChainUrl       string `validate:"required,gt=0" env:"BLOCK_STREAMER_CHAIN_URL,required"`
	ChainID        string `validate:"required,gt=0" env:"BLOCK_STREAMER_CHAIN_ID,required"`
}

// NOTE: only one replica of this service is needed
func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Loads env variables into a struct and validates them
	envvars, err := config.LoadEnvVars[EnvVars]()
	if err != nil {
		panic(err)
	}

	// Creates a redis stream client
	redisStreamClient := redis.NewClient(&redis.Options{
		Addr:                  envvars.RedisStreamUrl,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisStreamClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates an eth client
	ethClient, err := ethclient.Dial(envvars.ChainUrl)
	if err != nil {
		panic(err)
	}
	defer ethClient.Close()

	// Gets the block to start streaming from
	lastProcessedBlock, err := func() (*blockstore.BlockDocument, error) {
		// Creates a database connection pool
		pgClient, err := pgxpool.New(ctx, envvars.PostgresUrl)
		if err != nil {
			return nil, err
		}
		defer pgClient.Close()

		// Creates a redis store client
		redisStoreClient := redis.NewClient(&redis.Options{
			Addr:                  envvars.RedisStoreUrl,
			ContextTimeoutEnabled: true,
		})
		defer func() {
			if err := redisStoreClient.Close(); err != nil {
				common.LogError(nil, err)
			}
		}()

		// Creates a block store
		store := blockstore.NewRedisOptimizedBlockStore(
			blockstore.NewTimescaleBlockStore(pgClient),
			blockstore.NewRedisBlockStore(redisStoreClient),
		)

		// Gets the last block that was stored in the blockstore (if any)
		return store.GetLatestBlock(ctx, envvars.ChainID)
	}()
	if err != nil {
		panic(err)
	}

	// Extracts the last processed block height
	var startHeight *uint64 = nil
	if lastProcessedBlock != nil {
		startHeight = new(uint64)
		*startHeight = lastProcessedBlock.Height
	}

	// Creates the service
	service := etl.NewDataStreamer(
		etlproducers.NewEthBlockProducer(ethClient, startHeight),
		etlconsumers.NewBlockForwarder(streams.NewBlockStream(redisStreamClient, envvars.ChainID)),
	)

	// Runs the service until the context is cancelled
	if err = service.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
