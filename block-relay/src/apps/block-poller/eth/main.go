package main

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/common"
	"block-relay/src/libs/lib"
	"context"
	"os/signal"
	"syscall"

	"github.com/caarlos0/env/v10"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EnvVars struct {
	DatabaseUrl   string `validate:"required,gt=0" env:"BLOCK_POLLER_DATABASE_URL,required"`
	BlockchainUrl string `validate:"required,gt=0" env:"BLOCK_POLLER_BLOCKCHAIN_URL,required"`
	BlockchainId  string `validate:"required,gt=0" env:"BLOCK_POLLER_BLOCKCHAIN_ID,required"`
	BatchSize     int    `validate:"required,gt=0" env:"BLOCK_POLLER_BATCH_SIZE,required"`
	PollMs        int    `validate:"required,gt=0" env:"BLOCK_POLLER_POLL_MS,required"`
}

func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Parses env variables into a struct
	envvars := EnvVars{}
	if err := env.Parse(&envvars); err != nil {
		panic(err)
	}

	// Validates the env variables
	if err := common.ValidateStruct[EnvVars](envvars); err != nil {
		panic(err)
	}

	// Initializes the blockchain client
	chain, err := blockchains.NewEthereumBlockchain(&blockchains.BlockchainOpts{
		ChainUrl: envvars.BlockchainUrl,
		ChainID:  blockchains.ChainID(envvars.BlockchainId),
	})
	if err != nil {
		panic(err)
	} else {
		defer func() {
			if err := chain.Close(); err != nil {
				common.LogError(nil, err)
			}
		}()
	}

	// Creates a database connection pool
	dbConnPool, err := pgxpool.New(ctx, envvars.DatabaseUrl)
	if err != nil {
		panic(err)
	} else {
		defer dbConnPool.Close()
	}

	// Creates the service
	service := lib.NewBlockPoller(lib.BlockPollerParams{
		DatabaseConnPool: dbConnPool,
		Chain:            chain,
		Opts: lib.BlockPollerOpts{
			BatchSize: envvars.BatchSize,
			PollMs:    envvars.PollMs,
		},
	})

	// Runs the service until the context is cancelled
	err = service.Run(ctx)
	if err != nil {
		panic(err)
	}
}
