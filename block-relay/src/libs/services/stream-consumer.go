package services

import (
	"block-relay/src/libs/common"
	"block-relay/src/libs/messaging"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/errgroup"
)

type (
	IStreamProcessor interface {
		ProcessFailedMessage(ctx context.Context, msg redis.XMessage) error
		ProcessMessage(ctx context.Context, msg redis.XMessage) error
	}

	StreamConsumerOpts struct {
		StreamName        string
		ConsumerGroupName string
		ConsumerName      string
		MaxPoolSize       int
		BlockTimeoutMs    int
	}

	StreamConsumerParams struct {
		RedisClient *redis.Client
		Processor   IStreamProcessor
		Opts        *StreamConsumerOpts
	}

	StreamConsumer struct {
		redisClient *redis.Client
		processor   IStreamProcessor
		logger      *log.Logger
		opts        *StreamConsumerOpts
	}
)

// NOTE: this service can have multiple replicas
func NewStreamConsumer(params StreamConsumerParams) *StreamConsumer {
	return &StreamConsumer{
		logger:      log.New(os.Stdout, fmt.Sprintf("[%s] ", params.Opts.ConsumerName), log.LstdFlags),
		redisClient: params.RedisClient,
		processor:   params.Processor,
		opts:        params.Opts,
	}
}

func (service *StreamConsumer) Run(ctx context.Context) error {
	// Creates a consumer group if one doesn't already exist
	err := service.redisClient.XGroupCreateMkStream(ctx, service.opts.StreamName, service.opts.ConsumerGroupName, "$").Err()
	if err != nil && !errors.Is(err, redis.Nil) && !strings.Contains(err.Error(), "BUSYGROUP") {
		return err
	} else {
		service.logger.Printf("Consumer group \"%s\" is ready on stream \"%s\"\n", service.opts.ConsumerGroupName, service.opts.StreamName)
	}

	// Creates an errgroup
	eg := new(errgroup.Group)

	// Creates a fixed size Go routine pool that continuously processes data from
	// the stream until the context resolves or a non-recoverable error occurs
	for i := 0; i < service.opts.MaxPoolSize; i++ {
		consumerName := fmt.Sprintf("%s-%d", service.opts.ConsumerName, i)
		eg.Go(func() error {
			logger := log.New(os.Stdout, fmt.Sprintf("[%s] ", consumerName), log.LstdFlags)
			for {
				select {
				case <-ctx.Done():
					return nil
				default:
					if err := service.processBacklog(ctx, logger, consumerName); err != nil {
						return err
					}
					if err := service.processNewStreamEntries(ctx, logger, consumerName); err != nil {
						return err
					}
				}
			}
		})
	}

	// Waits for the workers to come to a complete stop and returns any errors
	if err := eg.Wait(); err != nil {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}

func (service *StreamConsumer) processNewStreamEntries(ctx context.Context, logger *log.Logger, consumerName string) error {
	// We use the special ">" ID which reads new messages that no other consumers
	// have seen. This causes the call will block until new data is ready.
	streams, err := service.redisClient.XReadGroup(ctx, &redis.XReadGroupArgs{
		Streams:  []string{service.opts.StreamName, ">"},
		Group:    service.opts.ConsumerGroupName,
		Consumer: consumerName,
		Count:    1,
		Block:    time.Duration(service.opts.BlockTimeoutMs) * time.Millisecond,
	}).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			// Timeout expired - no entries were found
			// Exit early and run this function again
			return nil
		}
		return err
	}

	// Gets the message from the XREADGROUP result
	msg, err := extractOneStreamMessage(streams, service.opts.StreamName)
	if err != nil {
		return err
	} else {
		logger.Printf("Successfully received stream message with ID \"%s\"\n", msg.ID)
	}

	// Processes the message
	if err := service.processor.ProcessMessage(ctx, msg); err != nil {
		// TODO: we may want to store this error in the database for the client to see
		common.LogError(service.logger, err)
		return nil
	} else {
		logger.Printf("Successfully processed stream message with ID \"%s\"\n", msg.ID)
	}

	// Returns nil if no errors occurred
	return nil
}

func (service *StreamConsumer) processBacklog(ctx context.Context, logger *log.Logger, consumerName string) error {
	// Defines a helper variable that keeps track of our position in the backlog
	cursorId := "-"

	// Continuously processes items from the backlog until there's nothing left
	for {
		// Reads a maximum of 1 item from the backlog
		pendingMsgs, err := service.redisClient.XPendingExt(ctx, &redis.XPendingExtArgs{
			Stream:   service.opts.StreamName,
			Group:    service.opts.ConsumerGroupName,
			Consumer: consumerName,
			Start:    cursorId,
			End:      "+",
			Count:    1,
		}).Result()
		if err != nil {
			return err
		}

		// Stops iterating if there is no data in the backlog
		if len(pendingMsgs) == 0 {
			return nil
		}

		// Gets the first item from the slice - throws an error if we received more than one item
		pendingMsg := pendingMsgs[0]
		if len(pendingMsgs) != 1 {
			return fmt.Errorf("received an unexpected number of pending messages: %v", pendingMsgs)
		} else {
			logger.Printf("Successfully retrieved backlog item with ID \"%s\"\n", pendingMsg.ID)
		}

		// Claims the message (which should increment its retry count) - if a message
		// is retryable (i.e. xMaxRetries is set in its metadata), then it is possible
		// that the message will not be retried exactly xMaxRetries times. This can
		// happen if the program crashes after we claim the message but before we are
		// able to actually process it (i.e. after this chunk of code executes)
		claimedMsgs, err := service.redisClient.XClaim(ctx, &redis.XClaimArgs{
			Stream:   service.opts.StreamName,
			Group:    service.opts.ConsumerGroupName,
			Consumer: consumerName,
			Messages: []string{pendingMsg.ID},
		}).Result()
		if err != nil {
			return err
		}

		// If we didn't get back exactly 1 message, then something is definitely wrong
		if len(claimedMsgs) != 1 {
			return fmt.Errorf("claimed an unexpected number of messages: %v", claimedMsgs)
		}

		// Checks that the message we claimed has the same ID as the pending message
		claimedMsg := claimedMsgs[0]
		if claimedMsg.ID != pendingMsg.ID {
			return fmt.Errorf("claimed message ID \"%s\" differs from pending message ID \"%s\"", claimedMsg.ID, pendingMsg.ID)
		}

		// Checks if the message has a field called XMaxRetries - if this field
		// exists and the current retry count exceeds this limit, then we delegate
		// the handling of the failed message to the processor. If a parsing error
		// occurs, the message is most likely not retryable so we'll move onto
		// processing it again as a normal message
		claimedMsgData, err := messaging.ParseMessage[messaging.RetryableMsgData](claimedMsg)
		if err == nil && pendingMsg.RetryCount >= int64(claimedMsgData.XMaxRetries) {
			if err := service.processor.ProcessFailedMessage(ctx, claimedMsg); err != nil {
				return err
			} else {
				continue
			}
		} else {
			logger.Printf("Successfully claimed stream message with ID \"%s\": %v\n", claimedMsg.ID, pendingMsg)
		}

		// Processes the message
		if err := service.processor.ProcessMessage(ctx, claimedMsg); err != nil {
			// TODO: we may want to store this somewhere for the client to see
			common.LogError(logger, err)
			continue
		} else {
			logger.Printf("Successfully processed stream message with ID \"%s\"\n", claimedMsg.ID)
		}

		// Moves onto the next backlog item
		cursorId = fmt.Sprintf("(%s", pendingMsg.ID)
	}
}

func extractOneStreamMessage(streams []redis.XStream, streamName string) (redis.XMessage, error) {
	for _, stream := range streams {
		if stream.Stream == streamName {
			if len(stream.Messages) != 1 {
				return redis.XMessage{}, fmt.Errorf("received an unexpected number of messages from stream: %v", stream.Messages)
			} else {
				return stream.Messages[0], nil
			}
		}
	}
	return redis.XMessage{}, fmt.Errorf("stream \"%s\" not found: %v", streamName, streams)
}
