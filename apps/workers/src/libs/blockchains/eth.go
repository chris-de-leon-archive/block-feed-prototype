package blockchains

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"

	ethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

const (
	ETH_TESTNET_SEPOLIA ChainID = "eth-testnet-sepolia"
	ETH_TESTNET_GOERLI  ChainID = "eth-testnet-goerli"
	ETH_MAINNET         ChainID = "eth-mainnet"
)

type EthereumBlockchain struct {
	client *ethclient.Client
	opts   *BlockchainOpts
	id     string
}

func NewEthereumBlockchain(opts *BlockchainOpts) (IBlockchain, error) {
	validChainIDs := map[ChainID]ChainID{
		ETH_TESTNET_SEPOLIA: ETH_TESTNET_SEPOLIA,
		ETH_TESTNET_GOERLI:  ETH_TESTNET_GOERLI,
		ETH_MAINNET:         ETH_MAINNET,
	}
	if _, exists := validChainIDs[opts.ChainID]; !exists {
		return nil, fmt.Errorf("\"%s\" is an invalid chain ID for Ethereum client", opts.ChainID)
	}

	client, err := ethclient.Dial(opts.ChainUrl)
	if err != nil {
		return nil, err
	}

	return &EthereumBlockchain{
		client: client,
		opts:   opts,
		id:     string(opts.ChainID),
	}, nil
}

func (blockchain *EthereumBlockchain) Close() error {
	blockchain.client.Close()
	return nil
}

func (blockchain *EthereumBlockchain) ID() string {
	return blockchain.id
}

func (blockchain *EthereumBlockchain) GetOpts() *BlockchainOpts {
	return blockchain.opts
}

func (blockchain *EthereumBlockchain) GetBlock(ctx context.Context, height *uint64) (*Block, error) {
	var h *big.Int
	if height != nil {
		h = (&big.Int{}).SetUint64(*height)
	}

	result, err := blockchain.client.BlockByNumber(ctx, h)
	if err != nil {
		return nil, err
	}

	block, err := stringifyBlock(result)
	if err != nil {
		return nil, err
	}

	return &Block{
		Height: result.NumberU64(),
		Data:   block,
	}, nil
}

func stringifyBlock(block *ethtypes.Block) ([]byte, error) {
	return json.MarshalIndent(map[string]any{
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
	}, "", " ")
}
