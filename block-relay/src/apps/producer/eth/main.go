package main

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/common"
	"block-relay/src/libs/lib"
	"context"
	"os/signal"
	"syscall"
)

func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Gets the blockchain client
	opts, err := common.ParseOpts[blockchains.BlockchainOptsEnv, blockchains.BlockchainOpts](func(env *blockchains.BlockchainOptsEnv) (*blockchains.BlockchainOpts, error) {
		return &blockchains.BlockchainOpts{
			ConnectionURL: env.ConnectionURL,
			ChainID:       blockchains.ChainID(env.ChainID),
		}, nil
	})
	if err != nil {
		panic(err)
	}

	// Initializes the blockchain client
	chain, err := blockchains.NewEthereumBlockchain(opts.ChainID, opts.ConnectionURL)
	if err != nil {
		panic(err)
	} else {
		defer chain.Close()
	}

	// Runs the producer until the context is cancelled
	err = lib.RunBlockProducer(ctx, chain)
	if err != nil {
		panic(err)
	}
}
