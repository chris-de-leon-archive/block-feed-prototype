package testutils

import (
	"block-feed/src/libs/blockchains"
	"fmt"
)

// TODO: delete this

var chainToClientFunc = map[blockchains.ChainID](func(opts *blockchains.BlockchainOpts) (blockchains.IBlockchain, error)){
	blockchains.ETH_TESTNET_SEPOLIA: func(opts *blockchains.BlockchainOpts) (blockchains.IBlockchain, error) {
		return blockchains.NewEthereumBlockchain(opts)
	},
	blockchains.ETH_TESTNET_GOERLI: func(opts *blockchains.BlockchainOpts) (blockchains.IBlockchain, error) {
		return blockchains.NewEthereumBlockchain(opts)
	},
	blockchains.ETH_MAINNET: func(opts *blockchains.BlockchainOpts) (blockchains.IBlockchain, error) {
		return blockchains.NewEthereumBlockchain(opts)
	},
	blockchains.FLOW_MAINNET: func(opts *blockchains.BlockchainOpts) (blockchains.IBlockchain, error) {
		return blockchains.NewFlowBlockchain(opts)
	},
	blockchains.FLOW_TESTNET: func(opts *blockchains.BlockchainOpts) (blockchains.IBlockchain, error) {
		return blockchains.NewFlowBlockchain(opts)
	},
}

type ChainResolver struct {
	// NOTE: we may want to limit the number connections
	// that can be stored in this map so that the number
	// of active RPC connections doesn't grow too large
	cache map[blockchains.ChainID]blockchains.IBlockchain
}

func NewChainResolver() *ChainResolver {
	return &ChainResolver{
		cache: map[blockchains.ChainID]blockchains.IBlockchain{},
	}
}

func (resolver *ChainResolver) Close(onError func(err error)) {
	for _, client := range resolver.cache {
		err := client.Close()
		if err != nil {
			onError(err)
		}
	}
}

func (resolver *ChainResolver) ResolveChain(opts *blockchains.BlockchainOpts) (blockchains.IBlockchain, error) {
	// Checks if a client with an active connection already exists
	if client, exists := resolver.cache[opts.ChainID]; exists {
		return client, nil
	}

	// If the chain exists, cache it and return its RPC client
	if getClient, exists := chainToClientFunc[opts.ChainID]; exists {
		client, err := getClient(opts)
		if err != nil {
			resolver.cache[opts.ChainID] = client
		}
		return client, err
	}

	// If the chain does not exist, throw an error
	return nil, fmt.Errorf("no resolver exists for chain \"%s\"", opts.ChainID)
}
