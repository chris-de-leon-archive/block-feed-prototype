package main

import (
	"appenv"
	"blockforwarder"
	"blockstore"
	"cachedstore"
	"common"
	"context"
	"ethsrc"
	"os/signal"
	"redistore"
	"streams"
	"syscall"
	"timescalestore"

	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	appenv.ChainEnv
}

// NOTE: only one replica of this service is needed per chain
func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Loads env variables into a struct and validates them
	envvars, err := appenv.LoadEnvVars[EnvVars]()
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
		pgClient, err := pgxpool.New(ctx, envvars.PgStoreUrl)
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
		store := cachedstore.NewRedisOptimizedBlockStore(
			timescalestore.NewTimescaleBlockStore(pgClient),
			redistore.NewRedisBlockStore(redisStoreClient),
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
	service := blockforwarder.NewBlockForwarder(
		ethsrc.NewEthBlockSource(ethClient, startHeight),
		streams.NewBlockStream(redisStreamClient, envvars.ChainID),
	)

	// Runs the service until the context is cancelled
	if err = service.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
