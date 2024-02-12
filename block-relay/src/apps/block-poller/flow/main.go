package main

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/common"
	"block-relay/src/libs/services"
	"block-relay/src/libs/sqlc"
	"context"
	"database/sql"
	"os/signal"
	"syscall"
	"time"
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

	// Loads env variables into a struct and validates them
	envvars, err := common.LoadEnvVars[EnvVars]()
	if err != nil {
		panic(err)
	}

	// Initializes the blockchain client
	chain, err := blockchains.NewFlowBlockchain(&blockchains.BlockchainOpts{
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

	// Makes sure the blockchain exists in the database
	func() {
		db, err := sql.Open("mysql", envvars.DatabaseUrl)
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
	service := services.NewBlockPoller(services.BlockPollerParams{
		Chain: chain,
		Opts: services.BlockPollerOpts{
			BatchSize: envvars.BatchSize,
			PollMs:    envvars.PollMs,
		},
	})

	// Runs the service until the context is cancelled
	err = service.Run(ctx)
	if err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
