package eventbus

import (
	"block-feed/src/libs/messaging"
	"context"
)

type IEventBus[T any] interface {
	Notify(ctx context.Context, channel string, msg *messaging.StreamMessage[T]) error
	Subscribe(ctx context.Context, channel string, handler func(msg *T) error) error
}
