package main

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/common"
	"block-relay/src/libs/services"
	"context"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
)

type EnvVars struct {
	DatabaseUrl         string `validate:"required,gt=0" env:"BLOCK_POLLER_DATABASE_URL,required"`
	BlockchainUrl       string `validate:"required,gt=0" env:"BLOCK_POLLER_BLOCKCHAIN_URL,required"`
	BlockchainId        string `validate:"required,gt=0" env:"BLOCK_POLLER_BLOCKCHAIN_ID,required"`
	Name                string `validate:"required,gt=0" env:"BLOCK_POLLER_NAME,required"`
	MaxInFlightRequests int    `validate:"required,gt=0" env:"BLOCK_POLLER_MAX_IN_FLIGHT_REQUESTS,required"`
	BatchSize           int    `validate:"required,gt=0" env:"BLOCK_POLLER_BATCH_SIZE,required"`
	PollMs              int    `validate:"required,gt=0" env:"BLOCK_POLLER_POLL_MS,required"`
}

func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Loads env variables into a struct and validates them
	envvars, err := common.LoadEnvVars[EnvVars]()
	if err != nil {
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
	service := services.NewBlockPoller(services.BlockPollerParams{
		DatabaseConnPool: dbConnPool,
		Chain:            chain,
		Opts: services.BlockPollerOpts{
			BatchSize: envvars.BatchSize,
			PollMs:    envvars.PollMs,
			Name:      envvars.Name,
		},
	})

	// Runs the service until the context is cancelled
	err = service.Run(ctx)
	if err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
