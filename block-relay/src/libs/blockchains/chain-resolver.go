package blockchains

import "fmt"

var chainToClientFunc = map[ChainID](func(opts BlockchainOpts) (IBlockchain, error)){
	ETH_TESTNET_SEPOLIA: func(opts BlockchainOpts) (IBlockchain, error) {
		return NewEthereumBlockchain(opts.ChainID, opts.ConnectionURL)
	},
	ETH_TESTNET_GOERLI: func(opts BlockchainOpts) (IBlockchain, error) {
		return NewEthereumBlockchain(opts.ChainID, opts.ConnectionURL)
	},
	ETH_MAINNET: func(opts BlockchainOpts) (IBlockchain, error) {
		return NewEthereumBlockchain(opts.ChainID, opts.ConnectionURL)
	},
	FLOW_MAINNET: func(opts BlockchainOpts) (IBlockchain, error) {
		return NewFlowBlockchain(opts.ChainID, opts.ConnectionURL)
	},
	FLOW_TESTNET: func(opts BlockchainOpts) (IBlockchain, error) {
		return NewFlowBlockchain(opts.ChainID, opts.ConnectionURL)
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

func (resolver *ChainResolver) Close() {
	for _, client := range resolver.cache {
		client.Close()
	}
}

func (resolver *ChainResolver) ResolveChain(opts BlockchainOpts) (IBlockchain, error) {
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
