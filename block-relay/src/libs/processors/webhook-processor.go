package processors

import (
	"block-relay/src/libs/constants"
	"block-relay/src/libs/messaging"
	"block-relay/src/libs/services"
	"block-relay/src/libs/sqlc"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type (
	WebhookProcessorOpts struct {
		MaxReschedulingRetries int32
	}

	WebhookProcessorParams struct {
		DatabaseConnPool *pgxpool.Pool
		RedisClient      *redis.Client
		Opts             *WebhookProcessorOpts
	}

	WebhookProcessor struct {
		redisClient *redis.Client
		dbConnPool  *pgxpool.Pool
		dbQueries   *sqlc.Queries
		opts        *WebhookProcessorOpts
	}
)

func NewWebhookProcessor(params WebhookProcessorParams) services.IStreamProcessor {
	return &WebhookProcessor{
		dbConnPool:  params.DatabaseConnPool,
		dbQueries:   sqlc.New(params.DatabaseConnPool),
		redisClient: params.RedisClient,
		opts:        params.Opts,
	}
}

func (service *WebhookProcessor) ProcessMessage(ctx context.Context, msg redis.XMessage) error {
	// Converts the incoming stream data to a strongly typed struct
	msgData, err := messaging.ParseMessage[messaging.WebhookMsgData](msg)
	if err != nil {
		return err
	}

	// Queries the database for the extended job data
	data, err := service.dbQueries.GetWebhookJob(ctx, msgData.JobID)
	if err != nil {
		return err
	}

	// Sends a request to the webhook endpoint only if there are blocks to send
	if len(data.CachedBlocks) > 0 {
		// Converts the cached blocks type from [][]byte to []string
		parsedBlocks := make([]string, len(data.CachedBlocks))
		for i, rawBlock := range data.CachedBlocks {
			parsedBlocks[i] = string(rawBlock)
		}

		// JSON encodes all the block data
		body, err := json.MarshalIndent(parsedBlocks, "", " ")
		if err != nil {
			return err
		}

		// Prepares a context aware POST request with all the blocks included in the payload
		req, err := http.NewRequestWithContext(
			ctx,
			"POST",
			data.WebhookUrl,
			bytes.NewBuffer(body),
		)
		if err != nil {
			return err
		} else {
			req.Header.Set("Content-Type", "application/json")
		}

		// Sends a synchronous POST request to the webhook URL
		httpClient := http.Client{Timeout: time.Duration(data.WebhookTimeoutMs) * time.Millisecond}
		_, err = httpClient.Do(req)
		if err != nil {
			return err
		}
	}

	// If the program is terminated AFTER the message is processed but
	// BEFORE the message is fully acknowledged (i.e. right here in the
	// code), then the client will receive the same request multiple times.

	// Marks this entry as completed
	if err = service.ack(ctx, msg, messaging.NewReschedulingMsg(
		msgData.JobID,
		msgData.WebhookID,
		msgData.XMaxRetries,
		len(data.CachedBlocks),
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

	return service.ack(ctx, msg,
		messaging.NewReschedulingMsg(
			msgData.JobID,
			msgData.WebhookID,
			service.opts.MaxReschedulingRetries,
			1, // If we couldn't send blocks [b1, b2], try [b1+1, b2+1] on the next run
		),
	)
}

func (service *WebhookProcessor) ack(ctx context.Context, msg redis.XMessage, data messaging.StreamMessage[messaging.ReschedulingMsgData]) error {
	// Acknowledges the job, deletes it from the stream, and adds it to another stream in one atomic operation
	ackScript := redis.NewScript(`
    local src_stream_name = KEYS[1]
    local dst_stream_name = KEYS[2]
    local consumer_group = KEYS[3]
    local message_id = ARGV[1]
    local msg_data_field = ARGV[2]
    local msg_data_value = ARGV[3]
    redis.call("XACK", src_stream_name, consumer_group, message_id)
    redis.call("XDEL", src_stream_name, message_id)
    redis.call("XADD", dst_stream_name, "*", msg_data_field, msg_data_value)
  `)

	// Executes the script
	scriptResult := ackScript.Run(ctx, service.redisClient,
		[]string{constants.WEBHOOK_STREAM, constants.RESCHEDULER_STREAM, constants.WEBHOOK_CONSUMER_GROUP_NAME},
		append([]any{msg.ID}, messaging.GetDataField(), data),
	)
	if err := scriptResult.Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}
