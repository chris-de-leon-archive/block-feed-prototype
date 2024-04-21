package blockchains

import "context"

// TODO: delete this package
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
