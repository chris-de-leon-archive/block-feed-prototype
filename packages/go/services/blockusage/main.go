package blockusage

import (
	"context"
	"streams"
)

type (
	BlockUsageOpts struct {
		ConsumerName string
		Concurrency  int
		MaxBlocks    int64
	}

	BlockUsageParams struct {
		BlockUsageStream *streams.BlockUsageStream
		Opts             *BlockUsageOpts
	}

	BlockUsage struct {
		blockUsageStream *streams.BlockUsageStream
		opts             *BlockUsageOpts
	}
)

func NewBlockUsage(params BlockUsageParams) *BlockUsage {
	return &BlockUsage{
		blockUsageStream: params.BlockUsageStream,
		opts:             params.Opts,
	}
}

func (service *BlockUsage) Run(ctx context.Context) error {
	return service.blockUsageStream.Subscribe(
		ctx,
		service.opts.ConsumerName,
		service.opts.Concurrency,
		1, // each consumer should only process 1 message / webhook at a time
		service.handleMessages,
	)
}

func (service *BlockUsage) handleMessages(
	ctx context.Context,
	msgs []streams.ParsedStreamMessage[streams.BlockUsageStreamMsgData],
	isBacklogMsg bool,
	metadata streams.SubscribeMetadata,
) error {
	return nil
}
