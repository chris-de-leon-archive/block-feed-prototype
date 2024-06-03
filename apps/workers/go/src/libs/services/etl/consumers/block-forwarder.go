package etlconsumer

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/streams"

	"golang.org/x/net/context"
)

type BlockForwarder struct {
	blockStream *streams.BlockStream
}

func NewBlockForwarder(blockStream *streams.BlockStream) *BlockForwarder {
	return &BlockForwarder{
		blockStream: blockStream,
	}
}

func (consumer *BlockForwarder) ProcessData(ctx context.Context, data blockstore.BlockDocument) error {
	return consumer.blockStream.XAdd(ctx, streams.NewBlockStreamMsg(data.Height, data.Data))
}
