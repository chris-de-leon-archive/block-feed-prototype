package etlproducers

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/common"
	"context"
	"encoding/json"
	"fmt"

	"github.com/onflow/flow-go-sdk"
	"github.com/onflow/flow-go-sdk/access/grpc"
)

type (
	FlowBlockProducerOpts struct {
		reconnectInitDelayMs *int
		reconnectRandDelayMs *int
		reconnectAttempts    *int
	}

	FlowBlockProducer struct {
		client     *grpc.Client
		currHeight *uint64
		opts       *FlowBlockProducerOpts
	}
)

func NewFlowBlockProducer(client *grpc.Client, startHeight *uint64, opts *FlowBlockProducerOpts) *FlowBlockProducer {
	options := &FlowBlockProducerOpts{}

	if opts != nil && opts.reconnectInitDelayMs != nil && *opts.reconnectInitDelayMs >= 0 {
		options.reconnectInitDelayMs = opts.reconnectInitDelayMs
	} else {
		options.reconnectInitDelayMs = new(int)
		*options.reconnectInitDelayMs = 500
	}

	if opts != nil && opts.reconnectRandDelayMs != nil && *opts.reconnectRandDelayMs >= 0 {
		options.reconnectRandDelayMs = opts.reconnectRandDelayMs
	} else {
		options.reconnectRandDelayMs = new(int)
		*options.reconnectRandDelayMs = 500
	}

	if opts != nil && opts.reconnectAttempts != nil && *opts.reconnectAttempts >= 0 {
		options.reconnectAttempts = opts.reconnectAttempts
	} else {
		options.reconnectAttempts = new(int)
		*options.reconnectAttempts = 3
	}

	return &FlowBlockProducer{
		client:     client,
		currHeight: startHeight,
		opts:       options,
	}
}

func (producer *FlowBlockProducer) Subscribe(ctx context.Context, handler func(ctx context.Context, data blockstore.BlockDocument) error) error {
	// If we received a nil startHeight, begin at the latest block
	if producer.currHeight == nil {
		block, err := producer.client.GetLatestBlock(ctx, true)
		if err != nil {
			return err
		} else {
			producer.currHeight = new(uint64)
			*producer.currHeight = block.Height
		}
	}

	// Subscribe to new blocks
	data, errs, err := producer.client.SubscribeExecutionDataByBlockHeight(ctx, *producer.currHeight)
	if err != nil {
		return err
	}

	// A helper function that will help us recover from connection issues
	reconnect := func() error {
		// Manually fetch the block that caused the subscription error
		block, err := producer.getBlockByHeight(ctx, *producer.currHeight)
		if err == nil {
			if err := handler(ctx, *block); err != nil {
				return err
			} else {
				*producer.currHeight += 1
			}
		}

		// Establish a new subscription
		_, err = common.ExponentialBackoff(
			ctx,
			*producer.opts.reconnectInitDelayMs,
			*producer.opts.reconnectAttempts,
			*producer.opts.reconnectRandDelayMs,
			func(retryCount int) (bool, error) {
				newData, newErrs, err := producer.client.SubscribeExecutionDataByBlockHeight(ctx, *producer.currHeight)
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
			block, err := producer.getBlockByID(ctx, resp.ExecutionData.BlockID)
			if err != nil {
				return err
			}
			if err := handler(ctx, *block); err != nil {
				return err
			}
			*producer.currHeight = resp.Height + 1

		}
	}
}

func (producer *FlowBlockProducer) getBlockByID(
	ctx context.Context,
	id flow.Identifier,
) (*blockstore.BlockDocument, error) {
	block, err := common.ExponentialBackoff(
		ctx,
		*producer.opts.reconnectInitDelayMs,
		*producer.opts.reconnectAttempts,
		*producer.opts.reconnectRandDelayMs,
		func(retryCount int) (*flow.Block, error) {
			return producer.client.GetBlockByID(ctx, id)
		},
	)
	if err != nil {
		return nil, err
	} else {
		return producer.formatBlock(block)
	}
}

func (producer *FlowBlockProducer) getBlockByHeight(
	ctx context.Context,
	height uint64,
) (*blockstore.BlockDocument, error) {
	block, err := common.ExponentialBackoff(
		ctx,
		*producer.opts.reconnectInitDelayMs,
		*producer.opts.reconnectAttempts,
		*producer.opts.reconnectRandDelayMs,
		func(retryCount int) (*flow.Block, error) {
			return producer.client.GetBlockByHeight(ctx, height)
		},
	)
	if err != nil {
		return nil, err
	} else {
		return producer.formatBlock(block)
	}
}

func (producer *FlowBlockProducer) formatBlock(
	block *flow.Block,
) (*blockstore.BlockDocument, error) {
	data, err := producer.stringifyBlock(block)
	if err != nil {
		return nil, err
	} else {
		return &blockstore.BlockDocument{Height: block.Height, Data: data}, nil
	}
}

func (producer *FlowBlockProducer) stringifyBlock(
	block *flow.Block,
) ([]byte, error) {
	return json.MarshalIndent(map[string]any{
		"id":             block.ID.String(),
		"parent_id":      block.ParentID.String(),
		"height":         block.Height,
		"timestamp":      block.Timestamp.String(),
		"status":         block.Status,
		"collection_ids": producer.mapifyCollectionGuarantees(block.CollectionGuarantees),
		"seals":          producer.mapifyBlockSeals(block.Seals),
	}, "", " ")
}

func (producer *FlowBlockProducer) mapifyCollectionGuarantees(slice []*flow.CollectionGuarantee) []map[string]string {
	result := make([]map[string]string, len(slice))
	for i := range result {
		result[i] = map[string]string{
			"collection_id": string(slice[i].CollectionID.String()),
		}
	}
	return result
}

func (producer *FlowBlockProducer) mapifyBlockSeals(slice []*flow.BlockSeal) []map[string]string {
	result := make([]map[string]string, len(slice))
	for i := range result {
		result[i] = map[string]string{
			"block_id":             string(slice[i].BlockID.String()),
			"execution_receipt_id": string(slice[i].ExecutionReceiptID.String()),
		}
	}
	return result
}
