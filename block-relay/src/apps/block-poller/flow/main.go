package main

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/common"
	"block-relay/src/libs/config"
	"block-relay/src/libs/services"
	"block-relay/src/libs/sqlc"
	"context"
	"database/sql"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	MySqlUrl            string `validate:"required,gt=0" env:"BLOCK_POLLER_MYSQL_URL,required"`
	RedisUrl            string `validate:"required,gt=0" env:"BLOCK_POLLER_REDIS_URL,required"`
	BlockchainUrl       string `validate:"required,gt=0" env:"BLOCK_POLLER_BLOCKCHAIN_URL,required"`
	BlockchainId        string `validate:"required,gt=0" env:"BLOCK_POLLER_BLOCKCHAIN_ID,required"`
	BatchSize           int    `validate:"required,gt=0" env:"BLOCK_POLLER_BATCH_SIZE,required"`
	MaxInFlightRequests int    `validate:"required,gt=0" env:"BLOCK_POLLER_MAX_IN_FLIGHT_REQUESTS,required"`
	BlockTimeoutMs      int    `validate:"required,gt=0" env:"BLOCK_POLLER_BLOCK_TIMEOUT_MS,required"`
	PollMs              int    `validate:"required,gt=0" env:"BLOCK_POLLER_POLL_MS,required"`
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
		mysqlClient, err := sql.Open("mysql", envvars.MySqlUrl)
		if err != nil {
			panic(err)
		} else {
			defer func() {
				if err := mysqlClient.Close(); err != nil {
					common.LogError(nil, err)
				}
			}()
			mysqlClient.SetConnMaxLifetime(time.Duration(30) * time.Second)
			mysqlClient.SetMaxOpenConns(1)
			mysqlClient.SetMaxIdleConns(1)
		}

		if _, err := sqlc.New(mysqlClient).UpsertBlockchain(ctx, &sqlc.UpsertBlockchainParams{
			ID:  chain.ID(),
			Url: chain.GetOpts().ChainUrl,
		}); err != nil {
			panic(err)
		}
	}()

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

	// Creates the service
	service := services.NewBlockPoller(services.BlockPollerParams{
		RedisClient: redisClient,
		Chain:       chain,
		Opts: services.BlockPollerOpts{
			MaxInFlightRequests: envvars.MaxInFlightRequests,
			BlockTimeoutMs:      envvars.BlockTimeoutMs,
			BatchSize:           envvars.BatchSize,
			PollMs:              envvars.PollMs,
		},
	})

	// Runs the service until the context is cancelled
	if err = service.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
