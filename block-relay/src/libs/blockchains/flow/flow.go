package flow

import (
	"block-relay/src/libs/common"
	"context"

	"github.com/onflow/flow-go-sdk"
	"github.com/onflow/flow-go-sdk/access"
	"github.com/onflow/flow-go-sdk/access/grpc"
)

type FlowBlockchain struct {
	client access.Client
}

func Blockchain(url string) *FlowBlockchain {
	client, err := grpc.NewClient(url)
	if err != nil {
		panic(err)
	}

	return &FlowBlockchain{
		client: client,
	}
}

func (this *FlowBlockchain) ID() string {
	return "flow"
}

func (this *FlowBlockchain) GetBlockAtHeight(ctx context.Context, height uint64) ([]byte, error) {
	block, err := this.client.GetBlockByHeight(ctx, uint64(height))
	if err != nil {
		return nil, err
	}

	txs, err := this.client.GetTransactionsByBlockID(ctx, block.ID)
	if err != nil {
		return nil, err
	}

	result, err := common.JsonStringify(
		common.MergeMaps(mapifyBlock(block), map[string]any{"transactions": mapifyTransactions(txs)}),
	)
	if err != nil {
		return nil, err
	}

	return []byte(result), nil
}

func (this *FlowBlockchain) GetLatestBlockHeight(ctx context.Context) (uint64, error) {
	block, err := this.client.GetLatestBlock(ctx, true)
	if err != nil {
		return 0, err
	}
	return block.Height, nil
}

func mapifyTransactions(txs []*flow.Transaction) []map[string]any {
	return common.Map(txs, func(tx *flow.Transaction, i int) map[string]any {
		return map[string]any{
			"id": tx.ID().String(),
			"arguments": common.Map(tx.Arguments, func(elem []byte, i int) string {
				return string(elem)
			}),
			"authorizers": common.Map(tx.Authorizers, func(elem flow.Address, i int) string {
				return elem.String()
			}),
			"envelope_signatures": common.Map(tx.EnvelopeSignatures, func(elem flow.TransactionSignature, i int) map[string]any {
				return mapifyTransactionSignature(elem)
			}),
			"gas_limit": tx.GasLimit,
			"payer":     tx.Payer.String(),
			"payload_signatures": common.Map(tx.PayloadSignatures, func(elem flow.TransactionSignature, i int) map[string]any {
				return mapifyTransactionSignature(elem)
			}),
			"proposal:key": map[string]any{
				"address":         tx.ProposalKey.Address.String(),
				"key_index":       tx.ProposalKey.KeyIndex,
				"sequence_number": tx.ProposalKey.SequenceNumber,
			},
			"reference_block_id": tx.ReferenceBlockID.String(),
			"script":             string(tx.Script),
		}
	})
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
	return common.Map(slice, func(elem *flow.CollectionGuarantee, i int) map[string]string {
		return map[string]string{
			"collection_id": string(elem.CollectionID.String()),
		}
	})
}

func mapifyBlockSeals(slice []*flow.BlockSeal) []map[string]string {
	return common.Map(slice, func(elem *flow.BlockSeal, i int) map[string]string {
		return map[string]string{
			"block_id":             string(elem.BlockID.String()),
			"execution_receipt_id": string(elem.ExecutionReceiptID.String()),
		}
	})
}

func mapifyTransactionSignature(txSig flow.TransactionSignature) map[string]any {
	return map[string]any{
		"address":      txSig.Address.String(),
		"key_index":    txSig.KeyIndex,
		"signature":    txSig.Signature,
		"signer_index": txSig.SignerIndex,
	}
}
