package blockchains

import "fmt"

var chainToClientFunc = map[ChainID](func(opts *BlockchainOpts) (IBlockchain, error)){
	ETH_TESTNET_SEPOLIA: func(opts *BlockchainOpts) (IBlockchain, error) {
		return NewEthereumBlockchain(opts)
	},
	ETH_TESTNET_GOERLI: func(opts *BlockchainOpts) (IBlockchain, error) {
		return NewEthereumBlockchain(opts)
	},
	ETH_MAINNET: func(opts *BlockchainOpts) (IBlockchain, error) {
		return NewEthereumBlockchain(opts)
	},
	FLOW_MAINNET: func(opts *BlockchainOpts) (IBlockchain, error) {
		return NewFlowBlockchain(opts)
	},
	FLOW_TESTNET: func(opts *BlockchainOpts) (IBlockchain, error) {
		return NewFlowBlockchain(opts)
	},
}

type ChainResolver struct {
	// NOTE: we may want to limit the number connections
	// that can be stored in this map so that the number
	// of active RPC connections doesn't grow too large
	cache map[ChainID]IBlockchain
}

func NewChainResolver() *ChainResolver {
	return &ChainResolver{
		cache: make(map[ChainID]IBlockchain),
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

func (resolver *ChainResolver) ResolveChain(opts *BlockchainOpts) (IBlockchain, error) {
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
