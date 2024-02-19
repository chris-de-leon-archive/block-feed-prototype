package blockchains

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"

	"github.com/onflow/flow-go-sdk"
	"github.com/onflow/flow-go-sdk/access"
	"github.com/onflow/flow-go-sdk/access/grpc"
)

type (
	FlowBlockchain struct {
		client access.Client
		opts   *BlockchainOpts
		id     string
	}
)

func NewFlowBlockchain(opts *BlockchainOpts) (IBlockchain, error) {
	validChainIDs := map[ChainID]ChainID{
		FLOW_TESTNET: FLOW_TESTNET,
		FLOW_MAINNET: FLOW_MAINNET,
	}
	if _, exists := validChainIDs[opts.ChainID]; !exists {
		return nil, fmt.Errorf("\"%s\" is an invalid chain ID for Flow client", opts.ChainID)
	}

	client, err := grpc.NewClient(opts.ChainUrl)
	if err != nil {
		return nil, err
	}

	return &FlowBlockchain{
		client: client,
		opts:   opts,
		id:     string(opts.ChainID),
	}, nil
}

func (blockchain *FlowBlockchain) Close() error {
	return blockchain.client.Close()
}

func (blockchain *FlowBlockchain) ID() string {
	return blockchain.id
}

func (blockchain *FlowBlockchain) GetOpts() *BlockchainOpts {
	return blockchain.opts
}

func (blockchain *FlowBlockchain) GetBlock(ctx context.Context, height *uint64) (*Block, error) {
	var block *flow.Block
	var err error

	if height == nil {
		block, err = blockchain.client.GetLatestBlock(ctx, true)
	} else {
		block, err = blockchain.client.GetBlockByHeight(ctx, *height)
	}
	if err != nil {
		return nil, err
	}

	txs, err := blockchain.client.GetTransactionsByBlockID(ctx, block.ID)
	if err != nil {
		return nil, err
	}

	blockWithTxs := mapifyBlock(block)
	maps.Copy(blockWithTxs, map[string]any{"transactions": mapifyTransactions(txs)})

	result, err := json.MarshalIndent(blockWithTxs, "", " ")
	if err != nil {
		return nil, err
	}

	return &Block{
		Height: block.Height,
		Data:   result,
	}, nil
}

func mapifyTransactions(txs []*flow.Transaction) []map[string]any {
	result := make([]map[string]any, len(txs))
	for i, tx := range txs {
		args := make([]string, len(tx.Arguments))
		for j := 0; j < len(tx.Arguments); j++ {
			args[j] = string(tx.Arguments[j])
		}

		authorizers := make([]string, len(tx.Authorizers))
		for j := 0; j < len(tx.Authorizers); j++ {
			authorizers[j] = tx.Authorizers[j].String()
		}

		envSigs := make([]map[string]any, len(tx.EnvelopeSignatures))
		for j := 0; j < len(tx.EnvelopeSignatures); j++ {
			envSigs[j] = mapifyTransactionSignature(tx.EnvelopeSignatures[j])
		}

		payloadSigs := make([]map[string]any, len(tx.PayloadSignatures))
		for j := 0; j < len(tx.PayloadSignatures); j++ {
			envSigs[j] = mapifyTransactionSignature(tx.PayloadSignatures[j])
		}

		result[i] = map[string]any{
			"id":                  tx.ID().String(),
			"arguments":           args,
			"authorizers":         authorizers,
			"envelope_signatures": envSigs,
			"gas_limit":           tx.GasLimit,
			"payer":               tx.Payer.String(),
			"payload_signatures":  payloadSigs,
			"proposal:key": map[string]any{
				"address":         tx.ProposalKey.Address.String(),
				"key_index":       tx.ProposalKey.KeyIndex,
				"sequence_number": tx.ProposalKey.SequenceNumber,
			},
			"reference_block_id": tx.ReferenceBlockID.String(),
			"script":             string(tx.Script),
		}
	}

	return result
}

func mapifyBlock(block *flow.Block) map[string]any {
	return map[string]any{
		"id":             block.ID.String(),
		"parent_id":      block.ParentID.String(),
		"height":         block.Height,
		"timestamp":      block.Timestamp.String(),
		"status":         block.Status,
		"collection_ids": mapifyCollectionGuarantees(block.CollectionGuarantees),
		"seals":          mapifyBlockSeals(block.Seals),
	}
}

func mapifyCollectionGuarantees(slice []*flow.CollectionGuarantee) []map[string]string {
	result := make([]map[string]string, len(slice))
	for i := range result {
		result[i] = map[string]string{
			"collection_id": string(slice[i].CollectionID.String()),
		}
	}
	return result
}

func mapifyBlockSeals(slice []*flow.BlockSeal) []map[string]string {
	result := make([]map[string]string, len(slice))
	for i := range result {
		result[i] = map[string]string{
			"block_id":             string(slice[i].BlockID.String()),
			"execution_receipt_id": string(slice[i].ExecutionReceiptID.String()),
		}
	}
	return result
}

func mapifyTransactionSignature(txSig flow.TransactionSignature) map[string]any {
	return map[string]any{
		"address":      txSig.Address.String(),
		"key_index":    txSig.KeyIndex,
		"signature":    txSig.Signature,
		"signer_index": txSig.SignerIndex,
	}
}
