package streaming

import (
	"block-feed/src/libs/common"
	"block-feed/src/libs/messaging"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/errgroup"
)

type (
	SubscribeMetadata struct {
		Logger            *log.Logger
		ConsumerGroupName string
		ConsumerName      string
	}
)

func extractOneStreamMessage(streams []redis.XStream, streamName string) (*redis.XMessage, error) {
	for _, stream := range streams {
		if stream.Stream == streamName {
			if len(stream.Messages) == 0 {
				return nil, nil
			}
			if len(stream.Messages) != 1 {
				return nil, fmt.Errorf("received an unexpected number of messages: %v", stream.Messages)
			}
			return &stream.Messages[0], nil
		}
	}
	return nil, fmt.Errorf("stream \"%s\" not found: %v", streamName, streams)
}

func xAckDel(
	ctx context.Context,
	redisClient *redis.Client,
	streamName string,
	consumerGroupName string,
	msgID string,
) error {
	// Acknowledges the message and deletes it from the stream in one atomic operation
	xAckDelScript := redis.NewScript(`
      local stream_key = KEYS[1]
      local consumer_group_key = KEYS[2]
      local msg_id = KEYS[3]

      redis.call("XACK", stream_key, consumer_group_key, msg_id)
      redis.call("XDEL", stream_key, msg_id)
    `)

	// Executes the script
	if err := xAckDelScript.Run(ctx, redisClient,
		[]string{
			streamName,
			consumerGroupName,
			msgID,
		},
		[]any{},
	).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	} else {
		return nil
	}
}

func getPendingMsg(
	ctx context.Context,
	redisClient *redis.Client,
	streamName string,
	consumerGroupName string,
	consumerName string,
	msgID string,
) (*redis.XPendingExt, error) {
	// Gets the pending data for this message
	pendingMsgs, err := redisClient.XPendingExt(ctx, &redis.XPendingExtArgs{
		Stream:   streamName,
		Group:    consumerGroupName,
		Consumer: consumerName,
		Start:    msgID,
		End:      msgID,
		Count:    1,
	}).Result()
	if err != nil {
		return nil, err
	}

	// Reports an error if we received no pending message data
	if len(pendingMsgs) != 1 {
		return nil, fmt.Errorf("received an unexpected number of pending messages: %v", pendingMsgs)
	}

	// Checks that the pending message ID is the same as the ID of the message we're processing
	pendingMsg := pendingMsgs[0]
	if msgID != pendingMsg.ID {
		return nil, fmt.Errorf("claimed message ID \"%s\" differs from pending message ID \"%s\"", msgID, pendingMsg.ID)
	} else {
		return &pendingMsg, nil
	}
}

func subscribe[T any](
	ctx context.Context,
	redisClient *redis.Client,
	logger *log.Logger,
	streamName string,
	consumerGroupName string,
	consumerName string,
	concurrency int,
	handler func(
		ctx context.Context,
		msgID string,
		msgData *T,
		isBacklogMsg bool,
		metadata SubscribeMetadata,
	) error,
) error {
	// Creates a consumer group if one doesn't already exist
	err := redisClient.XGroupCreateMkStream(ctx, streamName, consumerGroupName, "0-0").Err()
	if err != nil && !errors.Is(err, redis.Nil) && !strings.Contains(err.Error(), "BUSYGROUP") {
		return err
	} else {
		logger.Printf("Consumer group \"%s\" is ready on stream \"%s\"\n", consumerGroupName, streamName)
	}

	// If we want to process messages in order using one consumer, then we don't
	// need to spawn a go routine pool. Instead, we can process the messages directly
	// from this function and avoid the additional overhead.
	if concurrency == 1 {
		consumerName := fmt.Sprintf("%s-%d", consumerName, 0)
		for {
			select {
			case <-ctx.Done():
				return nil
			default:
				if err := processBacklogMsgs(
					ctx,
					redisClient,
					logger,
					streamName,
					consumerGroupName,
					consumerName,
					handler,
				); err != nil {
					return err
				}

				if err := processNewMsg(
					ctx,
					redisClient,
					logger,
					streamName,
					consumerGroupName,
					consumerName,
					handler,
				); err != nil {
					return err
				}
			}
		}
	}

	// If we want multiple consumers to process the stream, we create a fixed size Go
	// routine pool that continuously processes data from the stream until the context
	// resolves or a non-recoverable error occurs.
	eg := new(errgroup.Group)
	for i := 0; i < concurrency; i++ {
		consumerName := fmt.Sprintf("%s-%d", consumerName, i)
		eg.Go(func() error {
			logger := log.New(os.Stdout, fmt.Sprintf("[%s] ", consumerName), log.LstdFlags)
			logger.Printf("%s online\n", consumerName)
			for {
				select {
				case <-ctx.Done():
					return nil
				default:
					if err := processBacklogMsgs(
						ctx,
						redisClient,
						logger,
						streamName,
						consumerGroupName,
						consumerName,
						handler,
					); err != nil {
						return err
					}

					if err := processNewMsg(
						ctx,
						redisClient,
						logger,
						streamName,
						consumerGroupName,
						consumerName,
						handler,
					); err != nil {
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

func processNewMsg[T any](
	ctx context.Context,
	redisClient *redis.Client,
	logger *log.Logger,
	streamName string,
	consumerGroupName string,
	consumerName string,
	handler func(
		ctx context.Context,
		msgID string,
		msgData *T,
		isBacklogMsg bool,
		metadata SubscribeMetadata,
	) error,
) error {
	// We use the special ">" ID which reads new messages that no other consumers
	// have seen. This causes the call to block until new data is ready.
	streams, err := redisClient.XReadGroup(ctx, &redis.XReadGroupArgs{
		Streams:  []string{streamName, ">"},
		Group:    consumerGroupName,
		Consumer: consumerName,
		Count:    1,
		Block:    0,
	}).Result()
	if err != nil {
		return err
	}

	// Gets the message from the XREADGROUP result
	msg, err := extractOneStreamMessage(streams, streamName)
	if err != nil {
		return err
	} else {
		logger.Printf("Successfully received stream message with ID \"%s\"\n", msg.ID)
	}

	// Parses the message
	data, err := messaging.ParseMessage[T](*msg)
	if err != nil {
		return err
	}

	// Processes the message
	if err := handler(ctx, msg.ID, data, false, SubscribeMetadata{
		ConsumerGroupName: consumerGroupName,
		ConsumerName:      consumerName,
		Logger:            logger,
	}); err != nil {
		// TODO: we may want to store this error in the database for the client to see
		common.LogError(logger, err)
		return nil
	} else {
		logger.Printf("Successfully processed stream message with ID \"%s\"\n", msg.ID)
	}

	// Returns nil if no errors occurred
	return nil
}

func processBacklogMsgs[T any](
	ctx context.Context,
	redisClient *redis.Client,
	logger *log.Logger,
	streamName string,
	consumerGroupName string,
	consumerName string,
	handler func(
		ctx context.Context,
		msgID string,
		msgData *T,
		isBacklogMsg bool,
		metadata SubscribeMetadata,
	) error,
) error {
	// Defines a helper variable that keeps track of our position in the backlog
	cursorId := "0-0"

	// Continuously processes items from the backlog until there's nothing left
	for {
		// Claims a backlog message (which should increment its retry count) - if a
		// message is retryable (i.e. xMaxRetries is set in its metadata), then it is
		// possible that the message will not be retried exactly xMaxRetries times. This
		// can happen if the program crashes after we claim the message but before we
		// are able to actually process it (i.e. after this chunk of code executes)
		streams, err := redisClient.XReadGroup(ctx, &redis.XReadGroupArgs{
			Streams:  []string{streamName, cursorId},
			Group:    consumerGroupName,
			Consumer: consumerName,
			Count:    1,
		}).Result()
		if err != nil {
			return err
		}

		// Gets the message from the XREADGROUP result
		msg, err := extractOneStreamMessage(streams, streamName)
		if err != nil {
			return err
		}

		// Exits if there are no more messages in the backlog
		if msg == nil {
			if cursorId == "0-0" {
				return nil
			} else {
				cursorId = "0-0"
				continue
			}
		} else {
			logger.Printf("Successfully received stream message with ID \"%s\"\n", msg.ID)
		}

		// Parses the message
		data, err := messaging.ParseMessage[T](*msg)
		if err != nil {
			return err
		}

		// Processes the message
		if err := handler(ctx, msg.ID, data, true, SubscribeMetadata{
			ConsumerGroupName: consumerGroupName,
			ConsumerName:      consumerName,
			Logger:            logger,
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

func addOne[T any](
	ctx context.Context,
	redisClient *redis.Client,
	streamName string,
	msg *messaging.StreamMessage[T],
) error {
	// JSON encodes the data
	data, err := msg.MarshalBinary()
	if err != nil {
		return err
	}

	// Adds the data to the stream
	return redisClient.XAdd(ctx, &redis.XAddArgs{
		ID:     "*",
		Stream: streamName,
		Values: map[string]any{messaging.GetDataField(): data},
	}).Err()
}
