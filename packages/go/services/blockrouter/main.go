package blockrouter

import (
	"context"

	"github.com/chris-de-leon/block-feed-prototype/block-stores/blockstore"
	"github.com/chris-de-leon/block-feed-prototype/streams"

	"golang.org/x/sync/errgroup"
)

type (
	BlockRouterOpts struct {
		ConsumerName string
		BatchSize    int64
	}

	BlockRouterParams struct {
		BlockStream    *streams.BlockStream
		BlockStore     blockstore.IBlockStore
		Opts           *BlockRouterOpts
		WebhookStreams []*streams.WebhookStream
	}

	BlockRouter struct {
		blockStream    *streams.BlockStream
		blockStore     blockstore.IBlockStore
		opts           *BlockRouterOpts
		webhookStreams []*streams.WebhookStream
	}
)

func NewBlockRouter(params BlockRouterParams) *BlockRouter {
	return &BlockRouter{
		webhookStreams: params.WebhookStreams,
		blockStream:    params.BlockStream,
		blockStore:     params.BlockStore,
		opts:           params.Opts,
	}
}

func (service *BlockRouter) Run(ctx context.Context) error {
	return service.blockStream.Subscribe(
		ctx,
		service.opts.ConsumerName,
		1, // Only 1 consumer is necessary - blocks should be processed in order
		service.opts.BatchSize,
		service.handleMessages,
	)
}

func (service *BlockRouter) handleMessages(
	ctx context.Context,
	msgs []streams.ParsedStreamMessage[streams.BlockStreamMsgData],
	isBacklogMsg bool,
	metadata streams.SubscribeMetadata,
) error {
	// Parses the messages
	blocks := make([]blockstore.BlockDocument, len(msgs))
	msgIDs := make([]string, len(msgs))
	height := msgs[0].Data.Height
	for i, msg := range msgs {
		height = max(height, msg.Data.Height)
		msgIDs[i] = msg.ID
		blocks[i] = blockstore.BlockDocument{
			Height: msg.Data.Height,
			Data:   msg.Data.Block,
		}
	}

	// Idempotently adds the blocks to the block store
	if err := service.blockStore.PutBlocks(ctx, service.blockStream.Chain, blocks); err != nil {
		return err
	}

	// Idempotently reschedules the webhooks for processing
	eg := new(errgroup.Group)
	for _, webhookStream := range service.webhookStreams {
		stream := webhookStream
		eg.Go(func() error {
			return stream.Flush(ctx, height)
		})
	}

	// Waits for the lua scripts to execute and acks all the messages if no errors occurred
	if err := eg.Wait(); err != nil {
		return err
	} else {
		return service.blockStream.XAckDel(ctx, msgIDs)
	}
}
