package processing

import (
	"block-feed/src/libs/eventbus"
	"block-feed/src/libs/messaging"
	"block-feed/src/libs/streams"
	"context"
	"log"
	"os"
)

type (
	WebhookFlusherOpts struct {
		ChannelName string
	}

	WebhookFlusherParams struct {
		EventBus      eventbus.IEventBus[messaging.WebhookFlushStreamMsgData]
		WebhookStream *streams.RedisWebhookStream
		Opts          *WebhookFlusherOpts
	}

	WebhookFlusher struct {
		eventBus      eventbus.IEventBus[messaging.WebhookFlushStreamMsgData]
		webhookStream *streams.RedisWebhookStream
		opts          *WebhookFlusherOpts
		logger        *log.Logger
	}
)

// NOTE: a group of webhook processor replicas connected to a single redis instance need exactly one block flusher
func NewWebhookFlusher(params WebhookFlusherParams) *WebhookFlusher {
	return &WebhookFlusher{
		logger:        log.New(os.Stdout, "[block-flusher] ", log.LstdFlags),
		webhookStream: params.WebhookStream,
		eventBus:      params.EventBus,
		opts:          params.Opts,
	}
}

func (service *WebhookFlusher) Run(ctx context.Context) error {
	// If we received new blocks, flush any jobs interested in this new data
	lastFlushedBlockHeight := uint64(0)
	return service.eventBus.Subscribe(ctx, service.opts.ChannelName, func(msg *messaging.WebhookFlushStreamMsgData) error {
		defer func() { service.logger.Printf("System is synced up to block %d", lastFlushedBlockHeight) }()
		if msg.LatestBlockHeight > lastFlushedBlockHeight {
			service.logger.Println("Block height lag detected - flushing pending jobs")
			if err := service.webhookStream.Flush(ctx, msg.LatestBlockHeight); err != nil {
				return err
			} else {
				lastFlushedBlockHeight = msg.LatestBlockHeight
			}
		}
		return nil
	})
}
