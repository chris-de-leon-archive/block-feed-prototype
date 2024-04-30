package redistream

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
	RedisStream[T any] struct {
		client            Streamable
		logger            *log.Logger
		name              string
		consumerGroupName string
	}
)

func NewRedisStream[T any](
	client Streamable,
	name string,
	consumerGroupName string,
) *RedisStream[T] {
	return &RedisStream[T]{
		logger:            log.New(os.Stdout, fmt.Sprintf("[%s] ", name), log.LstdFlags),
		client:            client,
		name:              name,
		consumerGroupName: consumerGroupName,
	}
}

func (stream *RedisStream[T]) Name() string {
	return stream.name
}

func (stream *RedisStream[T]) ConsumerGroupName() string {
	return stream.consumerGroupName
}

func (stream *RedisStream[T]) XAdd(ctx context.Context, msg *messaging.StreamMessage[T]) error {
	// JSON encodes the data
	data, err := msg.MarshalBinary()
	if err != nil {
		return err
	}

	// Adds the data to the stream
	return stream.client.XAdd(ctx, &redis.XAddArgs{
		ID:     "*",
		Stream: stream.name,
		Values: map[string]any{messaging.GetDataField(): data},
	}).Err()
}

func (stream *RedisStream[T]) XAckDel(
	ctx context.Context,
	msgIDs []string,
) error {
	// Acknowledges the message and deletes it from the stream in one atomic operation
	xAckDelScript := redis.NewScript(`
    local stream_key = KEYS[1]
    local consumer_group_key = KEYS[2]
    for i = 1, #ARGV do
      local msg_id = ARGV[i]
      redis.call("XACK", stream_key, consumer_group_key, msg_id)
      redis.call("XDEL", stream_key, msg_id)
    end
  `)

	// Executes the script
	if err := xAckDelScript.Run(ctx, stream.client,
		[]string{
			stream.name,
			stream.consumerGroupName,
		},
		msgIDs,
	).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	} else {
		return nil
	}
}

func (stream *RedisStream[T]) GetPendingMsg(
	ctx context.Context,
	consumerName string,
	msgID string,
) (*redis.XPendingExt, error) {
	// Gets the pending data for this message
	pendingMsgs, err := stream.client.XPendingExt(ctx, &redis.XPendingExtArgs{
		Stream:   stream.name,
		Group:    stream.consumerGroupName,
		Consumer: consumerName,
		Start:    msgID,
		End:      msgID,
		Count:    1,
	}).Result()
	if err != nil {
		return nil, err
	}

	// TODO: return nil?
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

func (stream *RedisStream[T]) Subscribe(
	ctx context.Context,
	consumerName string,
	concurrency int,
	batchSize int64,
	handler func(
		ctx context.Context,
		msgs []*messaging.ParsedStreamMessage[*T],
		isBacklogMsg bool,
		metadata SubscribeMetadata,
	) error,
) error {
	// Creates a consumer group if one doesn't already exist
	err := stream.client.XGroupCreateMkStream(ctx, stream.name, stream.consumerGroupName, "0-0").Err()
	if err != nil && !errors.Is(err, redis.Nil) && !strings.Contains(err.Error(), "BUSYGROUP") {
		return err
	} else {
		stream.logger.Printf("Consumer group \"%s\" is ready on stream \"%s\"\n", stream.consumerGroupName, stream.name)
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
				if err := stream.processBacklogMsgs(
					ctx,
					consumerName,
					batchSize,
					handler,
				); err != nil {
					return err
				}

				if err := stream.processNewMsgs(
					ctx,
					consumerName,
					batchSize,
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
					if err := stream.processBacklogMsgs(
						ctx,
						consumerName,
						batchSize,
						handler,
					); err != nil {
						return err
					}

					if err := stream.processNewMsgs(
						ctx,
						consumerName,
						batchSize,
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

func (stream *RedisStream[T]) processNewMsgs(
	ctx context.Context,
	consumerName string,
	count int64,
	handler func(
		ctx context.Context,
		msgs []*messaging.ParsedStreamMessage[*T],
		isBacklogMsg bool,
		metadata SubscribeMetadata,
	) error,
) error {
	// We use the special ">" ID which reads new messages that no other consumers
	// have seen. This causes the call to block until new data is ready.
	streams, err := stream.client.XReadGroup(ctx, &redis.XReadGroupArgs{
		Streams:  []string{stream.name, ">"},
		Group:    stream.consumerGroupName,
		Consumer: consumerName,
		Count:    count,
		Block:    0,
	}).Result()
	if err != nil {
		return err
	}

	// Gets the messages from the XREADGROUP result
	msgs, err := stream.extractStreamMessages(streams)
	if err != nil {
		return err
	} else {
		stream.logger.Printf("Successfully received %d message(s)", len(msgs))
	}

	// Parses the message(s)
	parsedMsgs := make([]*messaging.ParsedStreamMessage[*T], len(msgs))
	for i, msg := range msgs {
		data, err := messaging.ParseMessage[T](msg)
		if err != nil {
			return err
		} else {
			parsedMsgs[i] = &messaging.ParsedStreamMessage[*T]{
				ID:   msg.ID,
				Data: data,
			}
		}
	}

	// Processes the message(s)
	if err := handler(ctx, parsedMsgs, false, SubscribeMetadata{
		ConsumerGroupName: stream.consumerGroupName,
		ConsumerName:      consumerName,
		Logger:            stream.logger,
	}); err != nil {
		// TODO: we may want to store this error in the database for the client to see
		common.LogError(stream.logger, err)
		return nil
	} else {
		stream.logger.Printf("Successfully processed %d stream message(s)", len(msgs))
	}

	// Returns nil if no errors occurred
	return nil
}

func (stream *RedisStream[T]) processBacklogMsgs(
	ctx context.Context,
	consumerName string,
	count int64,
	handler func(
		ctx context.Context,
		msgs []*messaging.ParsedStreamMessage[*T],
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
		streams, err := stream.client.XReadGroup(ctx, &redis.XReadGroupArgs{
			Streams:  []string{stream.name, cursorId},
			Group:    stream.consumerGroupName,
			Consumer: consumerName,
			Count:    count,
		}).Result()
		if err != nil {
			return err
		}

		// Gets the messages from the XREADGROUP result
		msgs, err := stream.extractStreamMessages(streams)
		if err != nil {
			return err
		}

		// Exits if there are no more messages in the backlog
		if len(msgs) == 0 {
			if cursorId == "0-0" {
				return nil
			} else {
				cursorId = "0-0"
				continue
			}
		} else {
			stream.logger.Printf("Successfully received %d stream message(s)", len(msgs))
		}

		// Parses the message(s)
		parsedMsgs := make([]*messaging.ParsedStreamMessage[*T], len(msgs))
		for i, msg := range msgs {
			data, err := messaging.ParseMessage[T](msg)
			if err != nil {
				return err
			} else {
				parsedMsgs[i] = &messaging.ParsedStreamMessage[*T]{
					ID:   msg.ID,
					Data: data,
				}
			}
		}

		// Processes the message
		if err := handler(ctx, parsedMsgs, true, SubscribeMetadata{
			ConsumerGroupName: stream.consumerGroupName,
			ConsumerName:      consumerName,
			Logger:            stream.logger,
		}); err != nil {
			// TODO: we may want to store this somewhere for the client to see
			common.LogError(stream.logger, err)
		} else {
			stream.logger.Printf("Successfully processed %d stream message(s)", len(msgs))
		}

		// Moves onto the next backlog item
		cursorId = msgs[len(msgs)-1].ID
	}
}

func (stream *RedisStream[T]) extractStreamMessages(streams []redis.XStream) ([]redis.XMessage, error) {
	for _, s := range streams {
		if s.Stream == stream.name {
			return s.Messages, nil
		}
	}
	return nil, fmt.Errorf("stream \"%s\" not found: %v", stream.name, streams)
}
