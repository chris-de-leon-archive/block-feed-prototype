package flowsrc

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/chris-de-leon/block-feed-prototype/block-stores/blockstore"
	"github.com/chris-de-leon/block-feed-prototype/common"

	"github.com/onflow/flow-go-sdk"
	"github.com/onflow/flow-go-sdk/access/grpc"
)

type (
	FlowBlockSourceOpts struct {
		ReconnectInitDelayMs *int
		ReconnectRandDelayMs *int
		ReconnectAttempts    *int
	}

	FlowBlockSource struct {
		client     *grpc.Client
		currHeight *uint64
		opts       *FlowBlockSourceOpts
	}
)

func NewFlowBlockSource(client *grpc.Client, startHeight *uint64, opts *FlowBlockSourceOpts) *FlowBlockSource {
	options := &FlowBlockSourceOpts{}

	if opts != nil && opts.ReconnectInitDelayMs != nil && *opts.ReconnectInitDelayMs >= 0 {
		options.ReconnectInitDelayMs = opts.ReconnectInitDelayMs
	} else {
		options.ReconnectInitDelayMs = new(int)
		*options.ReconnectInitDelayMs = 500
	}

	if opts != nil && opts.ReconnectRandDelayMs != nil && *opts.ReconnectRandDelayMs >= 0 {
		options.ReconnectRandDelayMs = opts.ReconnectRandDelayMs
	} else {
		options.ReconnectRandDelayMs = new(int)
		*options.ReconnectRandDelayMs = 500
	}

	if opts != nil && opts.ReconnectAttempts != nil && *opts.ReconnectAttempts >= 0 {
		options.ReconnectAttempts = opts.ReconnectAttempts
	} else {
		options.ReconnectAttempts = new(int)
		*options.ReconnectAttempts = 3
	}

	return &FlowBlockSource{
		client:     client,
		currHeight: startHeight,
		opts:       options,
	}
}

func (blockSource *FlowBlockSource) Subscribe(ctx context.Context, handler func(ctx context.Context, data blockstore.BlockDocument) error) error {
	// If we received a nil startHeight, begin at the latest block
	if blockSource.currHeight == nil {
		block, err := blockSource.client.GetLatestBlock(ctx, true)
		if err != nil {
			return err
		} else {
			blockSource.currHeight = new(uint64)
			*blockSource.currHeight = block.Height
		}
	}

	// Subscribe to new blocks
	data, errs, err := blockSource.client.SubscribeExecutionDataByBlockHeight(ctx, *blockSource.currHeight)
	if err != nil {
		return err
	}

	// A helper function that will help us recover from connection issues
	reconnect := func() error {
		// Instead of re-subscribing at the block that caused the subscription error,
		// we'll explicitly query the faulty block then re-subscribe at the next block
		// TODO: before subscribing at the next block, we should check if it exists
		block, err := blockSource.getBlockByHeight(ctx, *blockSource.currHeight)
		if err == nil {
			if err := handler(ctx, *block); err != nil {
				return err
			} else {
				*blockSource.currHeight += 1
			}
		}

		// Establish a new subscription
		_, err = common.ExponentialBackoff(
			ctx,
			*blockSource.opts.ReconnectInitDelayMs,
			*blockSource.opts.ReconnectAttempts,
			*blockSource.opts.ReconnectRandDelayMs,
			func(retryCount int) (bool, error) {
				newData, newErrs, err := blockSource.client.SubscribeExecutionDataByBlockHeight(ctx, *blockSource.currHeight)
				if err != nil {
					return false, err
				}
				data = newData
				errs = newErrs
				return true, nil
			},
		)
		if err != nil {
			return err
		}

		// Return nil if no errors occurred
		return nil
	}

	// Repeatedly process subscription data
	for {
		select {

		// If the context is completed, exit the loop
		case <-ctx.Done():
			return nil

		// If there was an error with the subscription, log it and reconnect
		case err, ok := <-errs:
			fmt.Println(err)
			if !ok {
				if ctx.Err() != nil {
					return nil
				}
			}
			if err := reconnect(); err != nil {
				return err
			}
			continue

		// If we received data, forward it to the handler and update the state
		case resp, ok := <-data:
			if !ok {
				if ctx.Err() != nil {
					return nil
				}
				if err := reconnect(); err != nil {
					return err
				}
				continue
			}
			block, err := blockSource.getBlockByID(ctx, resp.ExecutionData.BlockID)
			if err != nil {
				return err
			}
			if err := handler(ctx, *block); err != nil {
				return err
			}
			*blockSource.currHeight = resp.Height + 1

		}
	}
}

func (blockSource *FlowBlockSource) getBlockByID(ctx context.Context, id flow.Identifier) (*blockstore.BlockDocument, error) {
	block, err := common.ExponentialBackoff(
		ctx,
		*blockSource.opts.ReconnectInitDelayMs,
		*blockSource.opts.ReconnectAttempts,
		*blockSource.opts.ReconnectRandDelayMs,
		func(retryCount int) (*flow.Block, error) {
			return blockSource.client.GetBlockByID(ctx, id)
		},
	)
	if err != nil {
		return nil, err
	} else {
		return blockSource.formatBlock(block)
	}
}

func (blockSource *FlowBlockSource) getBlockByHeight(ctx context.Context, height uint64) (*blockstore.BlockDocument, error) {
	block, err := common.ExponentialBackoff(
		ctx,
		*blockSource.opts.ReconnectInitDelayMs,
		*blockSource.opts.ReconnectAttempts,
		*blockSource.opts.ReconnectRandDelayMs,
		func(retryCount int) (*flow.Block, error) {
			return blockSource.client.GetBlockByHeight(ctx, height)
		},
	)
	if err != nil {
		return nil, err
	} else {
		return blockSource.formatBlock(block)
	}
}

func (blockSource *FlowBlockSource) formatBlock(block *flow.Block) (*blockstore.BlockDocument, error) {
	data, err := blockSource.stringifyBlock(block)
	if err != nil {
		return nil, err
	} else {
		return &blockstore.BlockDocument{Height: block.Height, Data: data}, nil
	}
}

func (blockSource *FlowBlockSource) stringifyBlock(block *flow.Block) ([]byte, error) {
	return json.MarshalIndent(map[string]any{
		"id":             block.ID.String(),
		"parent_id":      block.ParentID.String(),
		"height":         block.Height,
		"timestamp":      block.Timestamp.String(),
		"status":         block.Status,
		"collection_ids": blockSource.mapifyCollectionGuarantees(block.CollectionGuarantees),
		"seals":          blockSource.mapifyBlockSeals(block.Seals),
	}, "", " ")
}

func (blockSource *FlowBlockSource) mapifyCollectionGuarantees(slice []*flow.CollectionGuarantee) []map[string]string {
	result := make([]map[string]string, len(slice))
	for i := range result {
		result[i] = map[string]string{
			"collection_id": string(slice[i].CollectionID.String()),
		}
	}
	return result
}

func (blockSource *FlowBlockSource) mapifyBlockSeals(slice []*flow.BlockSeal) []map[string]string {
	result := make([]map[string]string, len(slice))
	for i := range result {
		result[i] = map[string]string{
			"block_id":             string(slice[i].BlockID.String()),
			"execution_receipt_id": string(slice[i].ExecutionReceiptID.String()),
		}
	}
	return result
}
