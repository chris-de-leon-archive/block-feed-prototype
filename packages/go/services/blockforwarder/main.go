package blockforwarder

import (
	"blockstore"
	"context"
	"streams"
)

type (
	BlockSource interface {
		Subscribe(ctx context.Context, handler func(ctx context.Context, data blockstore.BlockDocument) error) error
	}

	BlockForwarder struct {
		src BlockSource
		dst *streams.BlockStream
	}
)

func NewBlockForwarder(src BlockSource, dst *streams.BlockStream) *BlockForwarder {
	return &BlockForwarder{src, dst}
}

func (blockForwarder *BlockForwarder) Run(ctx context.Context) error {
	return blockForwarder.src.Subscribe(ctx, func(ctx context.Context, data blockstore.BlockDocument) error {
		return blockForwarder.dst.XAdd(ctx, streams.NewBlockStreamMsg(data.Height, data.Data))
	})
}
