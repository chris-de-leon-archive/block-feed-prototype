package processing

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/streams"
	"context"

	"golang.org/x/sync/errgroup"
)

type (
	BlockStreamConsumerOpts struct {
		ConsumerName string
		BatchSize    int64
	}

	BlockStreamConsumerParams struct {
		BlockStream    *streams.BlockStream
		BlockStore     blockstore.IBlockStore
		Opts           *BlockStreamConsumerOpts
		WebhookStreams []*streams.WebhookStream
	}

	BlockStreamConsumer struct {
		blockStream    *streams.BlockStream
		blockStore     blockstore.IBlockStore
		opts           *BlockStreamConsumerOpts
		webhookStreams []*streams.WebhookStream
	}
)

func NewBlockStreamConsumer(params BlockStreamConsumerParams) *BlockStreamConsumer {
	return &BlockStreamConsumer{
		webhookStreams: params.WebhookStreams,
		blockStream:    params.BlockStream,
		blockStore:     params.BlockStore,
		opts:           params.Opts,
	}
}

func (service *BlockStreamConsumer) Run(ctx context.Context) error {
	return service.blockStream.Subscribe(
		ctx,
		service.opts.ConsumerName,
		1, // Only 1 consumer is necessary - blocks should be processed in order
		service.opts.BatchSize,
		service.handleMessages,
	)
}

func (service *BlockStreamConsumer) handleMessages(
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
