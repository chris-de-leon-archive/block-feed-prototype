package services

import (
	"block-relay/src/libs/common"
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
		ProcessMessage(ctx context.Context, msg redis.XMessage, isBacklogMsg bool, metadata ProcessMessageMetadata) error
		OnStartup(ctx context.Context, metadata OnStartupMetadata) error
	}

	ProcessMessageMetadata struct {
		Logger            *log.Logger
		StreamName        string
		ConsumerGroupName string
		ConsumerName      string
	}

	OnStartupMetadata struct {
		Logger            *log.Logger
		StreamName        string
		ConsumerGroupName string
		ConsumerPoolSize  int
	}

	StreamConsumerOpts struct {
		StreamName        string
		ConsumerGroupName string
		ConsumerName      string
		ConsumerPoolSize  int
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

// NOTE: the number of replicas this service can have depends on the processor
func NewStreamConsumer(params StreamConsumerParams) *StreamConsumer {
	return &StreamConsumer{
		logger:      log.New(os.Stdout, fmt.Sprintf("[%s] ", params.Opts.ConsumerName), log.LstdFlags),
		redisClient: params.RedisClient,
		processor:   params.Processor,
		opts:        params.Opts,
	}
}

func (service *StreamConsumer) Run(ctx context.Context) error {
	// Runs a startup function
	if err := service.processor.OnStartup(ctx, OnStartupMetadata{
		Logger:            service.logger,
		StreamName:        service.opts.StreamName,
		ConsumerGroupName: service.opts.ConsumerGroupName,
		ConsumerPoolSize:  service.opts.ConsumerPoolSize,
	}); err != nil {
		return err
	}

	// Creates a consumer group if one doesn't already exist
	err := service.redisClient.XGroupCreateMkStream(ctx, service.opts.StreamName, service.opts.ConsumerGroupName, "0-0").Err()
	if err != nil && !errors.Is(err, redis.Nil) && !strings.Contains(err.Error(), "BUSYGROUP") {
		return err
	} else {
		service.logger.Printf("Consumer group \"%s\" is ready on stream \"%s\"\n", service.opts.ConsumerGroupName, service.opts.StreamName)
	}

	// If we want to process messages in order using one consumer, then we don't
	// need to spawn a go routine pool with one worker. Instead, we can process
	// the messages directly from this function and avoid the additional overhead.
	if service.opts.ConsumerPoolSize == 1 {
		for {
			select {
			case <-ctx.Done():
				return nil
			default:
				if err := service.processBacklogMsgs(ctx, service.logger, service.opts.ConsumerName); err != nil {
					return err
				}
				if err := service.processNewMsg(ctx, service.logger, service.opts.ConsumerName); err != nil {
					return err
				}
			}
		}
	}

	// If we want multiple consumers to process the stream, we create a fixed size Go
	// routine pool that continuously processes data from the stream until the context
	// resolves or a non-recoverable error occurs.
	eg := new(errgroup.Group)
	for i := 0; i < service.opts.ConsumerPoolSize; i++ {
		consumerName := fmt.Sprintf("%s-%d", service.opts.ConsumerName, i)
		eg.Go(func() error {
			logger := log.New(os.Stdout, fmt.Sprintf("[%s] ", consumerName), log.LstdFlags)
			logger.Printf("%s online\n", consumerName)
			for {
				select {
				case <-ctx.Done():
					return nil
				default:
					if err := service.processBacklogMsgs(ctx, logger, consumerName); err != nil {
						return err
					}
					if err := service.processNewMsg(ctx, logger, consumerName); err != nil {
						return err
					}
				}
			}
		})
	}

	// Waits for the workers to come to a complete stop then returns any errors
	if err := eg.Wait(); err != nil {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}

func (service *StreamConsumer) processNewMsg(ctx context.Context, logger *log.Logger, consumerName string) error {
	// We use the special ">" ID which reads new messages that no other consumers
	// have seen. This causes the call to block until new data is ready.
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
	}

	// Exits if there are no new messages
	if msg == nil {
		return nil
	} else {
		logger.Printf("Successfully received stream message with ID \"%s\"\n", msg.ID)
	}

	// Processes the message
	if err := service.processor.ProcessMessage(ctx, *msg, false, ProcessMessageMetadata{
		Logger:            logger,
		StreamName:        service.opts.StreamName,
		ConsumerGroupName: service.opts.ConsumerGroupName,
		ConsumerName:      consumerName,
	}); err != nil {
		// TODO: we may want to store this error in the database for the client to see
		common.LogError(service.logger, err)
		return nil
	} else {
		logger.Printf("Successfully processed stream message with ID \"%s\"\n", msg.ID)
	}

	// Returns nil if no errors occurred
	return nil
}

func (service *StreamConsumer) processBacklogMsgs(ctx context.Context, logger *log.Logger, consumerName string) error {
	// Defines a helper variable that keeps track of our position in the backlog
	cursorId := "0-0"

	// Continuously processes items from the backlog until there's nothing left
	for {
		// Claims a backlog message (which should increment its retry count) - if a
		// message is retryable (i.e. xMaxRetries is set in its metadata), then it is
		// possible that the message will not be retried exactly xMaxRetries times. This
		// can happen if the program crashes after we claim the message but before we
		// are able to actually process it (i.e. after this chunk of code executes)
		streams, err := service.redisClient.XReadGroup(ctx, &redis.XReadGroupArgs{
			Streams:  []string{service.opts.StreamName, cursorId},
			Group:    service.opts.ConsumerGroupName,
			Consumer: consumerName,
			Count:    1,
		}).Result()
		if err != nil {
			return err
		}

		// Gets the message from the XREADGROUP result
		msg, err := extractOneStreamMessage(streams, service.opts.StreamName)
		if err != nil {
			return err
		}

		// Exits if there are no more messages in the backlog
		if msg == nil {
			return nil
		} else {
			logger.Printf("Successfully received stream message with ID \"%s\"\n", msg.ID)
		}

		// Processes the message
		if err := service.processor.ProcessMessage(ctx, *msg, true, ProcessMessageMetadata{
			Logger:            logger,
			StreamName:        service.opts.StreamName,
			ConsumerGroupName: service.opts.ConsumerGroupName,
			ConsumerName:      consumerName,
		}); err != nil {
			// TODO: we may want to store this somewhere for the client to see
			common.LogError(logger, err)
		} else {
			logger.Printf("Successfully processed stream message with ID \"%s\"\n", msg.ID)
		}

		// Moves onto the next backlog item
		cursorId = msg.ID
	}
}
