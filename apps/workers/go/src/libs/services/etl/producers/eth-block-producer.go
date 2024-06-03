package etlproducers

import (
	"block-feed/src/libs/blockstore"
	"context"
	"encoding/json"
	"math/big"

	ethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

type EthBlockProducer struct {
	client     *ethclient.Client
	currHeight *uint64
}

func NewEthBlockProducer(client *ethclient.Client, startHeight *uint64) *EthBlockProducer {
	return &EthBlockProducer{
		client:     client,
		currHeight: startHeight,
	}
}

func (producer *EthBlockProducer) Subscribe(ctx context.Context, handler func(ctx context.Context, data blockstore.BlockDocument) error) error {
	headers := make(chan *ethtypes.Header)
	defer close(headers)

	sub, err := producer.client.SubscribeNewHead(ctx, headers)
	if err != nil {
		return err
	}

	isBehind := producer.currHeight != nil
	for {
		select {
		case <-ctx.Done():
			return nil
		case err, ok := <-sub.Err():
			if !ok {
				return nil
			}
			return err
		case header, ok := <-headers:
			if !ok {
				return nil
			}

			if isBehind {
				// When comparing two big ints (say x and y), Cmp will behave as follows:
				//
				//   Cmp == -1 if x < y
				//   Cmp == 0 if x == y
				//   Cmp == 1 if x > y
				//
				// Here, we're checking if Cmp != 1, which actually means we're checking if
				// x <= y. In other words, we're running a loop which keeps collecting blocks
				// from source.currHeight until we reach header.Number. We only need to run
				// this loop one time - once we're caught up to the latest block header there
				// is no need to catch up again.
				//
				for (&big.Int{}).SetUint64(*producer.currHeight).Cmp(header.Number) != 1 {
					block, err := producer.client.BlockByNumber(ctx, (&big.Int{}).SetUint64(*producer.currHeight))
					if err != nil {
						return err
					}
					data, err := producer.stringifyBlock(block)
					if err != nil {
						return err
					}
					if err := handler(ctx, blockstore.BlockDocument{Height: block.Number().Uint64(), Data: data}); err != nil {
						return err
					}
					*producer.currHeight += 1
				}
				isBehind = false
			} else {
				block, err := producer.client.BlockByNumber(ctx, header.Number)
				if err != nil {
					return err
				}
				data, err := producer.stringifyBlock(block)
				if err != nil {
					return err
				}
				if err := handler(ctx, blockstore.BlockDocument{Height: header.Number.Uint64(), Data: data}); err != nil {
					return err
				}
			}
		}
	}
}

func (producer *EthBlockProducer) stringifyBlock(block *ethtypes.Block) ([]byte, error) {
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
