package blockchains

import "context"

const (
	ETH_TESTNET_SEPOLIA ChainID = "eth-testnet-sepolia"
	ETH_TESTNET_GOERLI  ChainID = "eth-testnet-goerli"
	ETH_MAINNET         ChainID = "eth-mainnet"
	FLOW_MAINNET        ChainID = "flow-mainnet"
	FLOW_TESTNET        ChainID = "flow-testnet"
)

type (
	ChainID string

	BlockchainOpts struct {
		ChainUrl string
		ChainID  ChainID
	}

	Block struct {
		Data   []byte
		Height uint64
	}

	IBlockchain interface {
		GetBlock(ctx context.Context, height *uint64) (*Block, error)
		GetOpts() *BlockchainOpts
		ID() string
		Close() error
	}
)
