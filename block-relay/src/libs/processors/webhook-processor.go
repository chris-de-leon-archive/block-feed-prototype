package processors

import (
	"block-relay/src/libs/constants"
	"block-relay/src/libs/messaging"
	"block-relay/src/libs/services"
	"block-relay/src/libs/sqlc"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

type (
	WebhookProcessorParams struct {
		DatabaseClient *sql.DB
		RedisClient    *redis.Client
	}

	WebhookProcessor struct {
		redisClient *redis.Client
		dbClient    *sql.DB
		dbQueries   *sqlc.Queries
	}
)

func NewWebhookProcessor(params WebhookProcessorParams) services.IStreamProcessor {
	return &WebhookProcessor{
		dbClient:    params.DatabaseClient,
		dbQueries:   sqlc.New(params.DatabaseClient),
		redisClient: params.RedisClient,
	}
}

func (service *WebhookProcessor) ProcessMessage(ctx context.Context, msg redis.XMessage) error {
	// Converts the incoming stream data to a strongly typed struct
	msgData, err := messaging.ParseMessage[messaging.WebhookMsgData](msg)
	if err != nil {
		return err
	}

	// Gets the webhook data - if it is no longer in the database this
	// stream entry will be deleted and we won't send the blocks
	webhook, err := service.dbQueries.GetWebhook(ctx, msgData.WebhookID)
	if errors.Is(err, sql.ErrNoRows) {
		if err := service.ack(ctx, msg, nil); err != nil {
			return err
		}
		return nil
	}
	if err != nil {
		return err
	}

	// Gets the cached blocks (range is inclusive)
	blocks, err := service.redisClient.ZRangeByScore(ctx,
		fmt.Sprintf(constants.CACHE_NAME_TEMPLATE, msgData.ChainID),
		&redis.ZRangeBy{
			Min: strconv.FormatUint(msgData.BlockHeight, 10),
			Max: strconv.FormatUint(msgData.BlockHeight+uint64(webhook.MaxBlocks), 10),
		},
	).Result()
	if err != nil {
		return err
	}

	// Sends a request to the webhook endpoint only if there are blocks to send
	if len(blocks) > 0 {
		// JSON encodes all the block data
		body, err := json.MarshalIndent(blocks, "", " ")
		if err != nil {
			return err
		}

		// Prepares a context aware POST request with all the blocks included in the payload
		req, err := http.NewRequestWithContext(
			ctx,
			"POST",
			webhook.Url,
			bytes.NewBuffer(body),
		)
		if err != nil {
			return err
		} else {
			req.Header.Set("Content-Type", "application/json")
		}

		// Sends a synchronous POST request to the webhook URL
		httpClient := http.Client{Timeout: time.Duration(webhook.TimeoutMs) * time.Millisecond}
		if _, err := httpClient.Do(req); err != nil {
			return err
		}
	}

	// If the program is terminated AFTER the message is processed but
	// BEFORE the message is fully acknowledged (i.e. right here in the
	// code), then the client will receive the same request multiple times.

	// Marks this entry as completed
	if err = service.ack(ctx, msg, messaging.NewWebhookMsg(
		msgData.ChainID,
		msgData.BlockHeight+uint64(len(blocks)),
		msgData.WebhookID,
		msgData.XMaxRetries,
	)); err != nil {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}

func (service *WebhookProcessor) ProcessFailedMessage(ctx context.Context, msg redis.XMessage) error {
	msgData, err := messaging.ParseMessage[messaging.WebhookMsgData](msg)
	if err != nil {
		return err
	}

	// TODO: might be better to skip to the latest block, so that failed
	// jobs don't make the cache too large
	return service.ack(ctx, msg,
		messaging.NewWebhookMsg(
			msgData.ChainID,
			msgData.BlockHeight+1, // if we could not process [h1, h2], try [h1+1, h2+1]
			msgData.WebhookID,
			msgData.XMaxRetries,
		),
	)
}

func (service *WebhookProcessor) ack(ctx context.Context, msg redis.XMessage, newMsg *messaging.StreamMessage[messaging.WebhookMsgData]) error {
	if newMsg == nil {
		// Acknowledges the job and deletes it from the stream in one atomic operation
		ackScript := redis.NewScript(`
      local stream_name = KEYS[1]
      local consumer_group = KEYS[2]
      local message_id = KEYS[3]
      local message_data = ARGV[1]
      redis.call("RPUSH", waitlist_name, message_data)
      redis.call("XACK", stream_name, consumer_group, message_id)
      redis.call("XDEL", stream_name, message_id)
    `)

		// Executes the script
		if err := ackScript.Run(ctx, service.redisClient,
			[]string{
				constants.WEBHOOK_STREAM,
				constants.WEBHOOK_CONSUMER_GROUP_NAME,
				msg.ID,
			},
			newMsg,
		).Err(); err != nil && !errors.Is(err, redis.Nil) {
			return err
		}
	} else {
		// Acknowledges the job, deletes it from the stream, and updates the waitlist in one atomic operation
		ackScript := redis.NewScript(`
      local waitlist_name = KEYS[1]
      local stream_name = KEYS[2]
      local consumer_group = KEYS[3]
      local message_id = KEYS[4]
      local message_data = ARGV[1]
      redis.call("RPUSH", waitlist_name, message_data)
      redis.call("XACK", stream_name, consumer_group, message_id)
      redis.call("XDEL", stream_name, message_id)
    `)

		// Executes the script
		if err := ackScript.Run(ctx, service.redisClient,
			[]string{
				fmt.Sprintf(constants.WAITLIST_NAME_TEMPLATE, newMsg.Data.ChainID),
				constants.WEBHOOK_STREAM,
				constants.WEBHOOK_CONSUMER_GROUP_NAME,
				msg.ID,
			},
			newMsg,
		).Err(); err != nil && !errors.Is(err, redis.Nil) {
			return err
		}
	}

	// Returns nil if no errors occurred
	return nil
}
