package etlconsumer

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/eventbus"
	"block-feed/src/libs/messaging"

	"golang.org/x/net/context"
)

type BlockStoreConsumer struct {
	blockstore blockstore.IBlockStore
	eventbus   eventbus.IEventBus[messaging.WebhookFlushStreamMsgData]
	chainID    string
}

func NewBlockStoreConsumer(
	chainID string,
	blockstore blockstore.IBlockStore,
	eventbus eventbus.IEventBus[messaging.WebhookFlushStreamMsgData],
) *BlockStoreConsumer {
	return &BlockStoreConsumer{
		blockstore: blockstore,
		eventbus:   eventbus,
		chainID:    chainID,
	}
}

func (consumer *BlockStoreConsumer) ProcessData(ctx context.Context, data blockstore.BlockDocument) error {
	if err := consumer.blockstore.PutBlocks(
		ctx,
		consumer.chainID,
		[]blockstore.BlockDocument{data},
	); err != nil {
		return err
	}

	return consumer.eventbus.Notify(
		ctx,
		consumer.chainID,
		messaging.NewWebhookFlushStreamMsg(data.Height),
	)
}
