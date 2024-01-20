package blockchains

import (
	"block-relay/src/libs/common"
	"context"
	"fmt"
	"math/big"

	ethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

type EthereumBlockchain struct {
	client *ethclient.Client
	opts   *BlockchainOpts
}

func NewEthereumBlockchain(id ChainID, url string) (IBlockchain, error) {
	validChainIDs := map[ChainID]ChainID{
		ETH_TESTNET_SEPOLIA: ETH_TESTNET_SEPOLIA,
		ETH_TESTNET_GOERLI:  ETH_TESTNET_GOERLI,
		ETH_MAINNET:         ETH_MAINNET,
	}
	if _, exists := validChainIDs[id]; !exists {
		return nil, fmt.Errorf("\"%s\" is an invalid chain ID for Ethereum client", id)
	}

	client, err := ethclient.Dial(url)
	if err != nil {
		return nil, err
	}

	return &EthereumBlockchain{
		client: client,
		opts: &BlockchainOpts{
			ConnectionURL: url,
			ChainID:       id,
		},
	}, nil
}

func (blockchain *EthereumBlockchain) Close() {
	blockchain.client.Close()
}

func (blockchain *EthereumBlockchain) GetOpts() *BlockchainOpts {
	return blockchain.opts
}

func (blockchain *EthereumBlockchain) GetBlockAtHeight(ctx context.Context, height uint64) ([]byte, error) {
	result, err := blockchain.client.BlockByNumber(ctx, (&big.Int{}).SetUint64(height))
	if err != nil {
		return nil, err
	}

	block, err := stringifyBlock(result)
	if err != nil {
		return nil, err
	}

	return []byte(block), nil
}

func (blockchain *EthereumBlockchain) GetLatestBlockHeight(ctx context.Context) (uint64, error) {
	result, err := blockchain.client.BlockNumber(ctx)
	if err != nil {
		return 0, err
	}
	return result, nil
}

func stringifyBlock(block *ethtypes.Block) (string, error) {
	return common.JsonStringify(map[string]any{
		"receivedAt": block.ReceivedAt.String(),
		"baseFee":    block.BaseFee().String(),
		// "beaconRoot":     block.BeaconRoot().String(), // throws an error
		"blobGasUsed": block.BlobGasUsed(),
		"bloom":       block.Bloom().Bytes(),
		// "body":            block.Body(), // redundant
		"coinbase":      block.Coinbase().String(),
		"difficulty":    block.Difficulty().String(),
		"excessBlobGas": block.ExcessBlobGas(),
		"extra":         block.Extra(),
		"gasLimit":      block.GasLimit(),
		"gasUsed":       block.GasUsed(),
		"hash":          block.Hash().String(),
		"header":        block.Header(),
		"mixDigest":     block.MixDigest().String(),
		"nonce":         block.Nonce(),
		"number":        block.Number(),
		"parentHash":    block.ParentHash().String(),
		"receiptHash":   block.ReceiptHash().String(),
		"root":          block.Root().String(),
		"size":          block.Size(),
		"time":          block.Time(),
		"transactions":  block.Transactions(),
		"txHash":        block.TxHash().String(),
		"uncleHash":     block.UncleHash().String(),
		"uncles":        block.Uncles(),
		"withdrawals":   block.Withdrawals(),
	})
}
