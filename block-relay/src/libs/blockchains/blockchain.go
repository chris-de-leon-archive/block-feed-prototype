package blockchains

import "context"

type (
	IBlockchain interface {
		GetBlockAtHeight(ctx context.Context, height uint64) ([]byte, error)
		GetLatestBlockHeight(ctx context.Context) (uint64, error)
		GetOpts() *BlockchainOpts
		Close()
	}
)
