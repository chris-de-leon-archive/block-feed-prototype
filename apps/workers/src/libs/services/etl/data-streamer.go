package etl

import (
	"context"
)

type (
	DataStreamerConsumer[T any] interface {
		ProcessData(ctx context.Context, data T) error
	}

	DataStreamerProducer[T any] interface {
		Subscribe(ctx context.Context, handler func(ctx context.Context, data T) error) error
	}

	DataStreamer[T any] struct {
		producer DataStreamerProducer[T]
		consumer DataStreamerConsumer[T]
	}
)

func NewDataStreamer[T any](
	producer DataStreamerProducer[T],
	consumer DataStreamerConsumer[T],
) *DataStreamer[T] {
	return &DataStreamer[T]{
		producer: producer,
		consumer: consumer,
	}
}

func (streamer *DataStreamer[T]) Run(ctx context.Context) error {
	return streamer.producer.Subscribe(ctx, streamer.consumer.ProcessData)
}
