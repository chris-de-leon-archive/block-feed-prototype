package processors

import (
	"block-feed/src/libs/common"
	"block-feed/src/libs/constants"
	"block-feed/src/libs/messaging"
	"block-feed/src/libs/services"
	"block-feed/src/libs/sqlc"
	"context"
	"database/sql"
	"errors"

	"github.com/redis/go-redis/v9"
)

type (
	WebhookActivationProcessorParams struct {
		RedisClient *redis.Client
		MySqlClient *sql.DB
	}

	WebhookActivationProcessor struct {
		redisClient *redis.Client
		mysqlClient *sql.DB
	}
)

// NOTE: multiple replicas of this service can be created
func NewWebhookActivationProcessor(params WebhookActivationProcessorParams) services.IStreamProcessor {
	return &WebhookActivationProcessor{
		redisClient: params.RedisClient,
		mysqlClient: params.MySqlClient,
	}
}

func (service *WebhookActivationProcessor) OnStartup(ctx context.Context, metadata services.OnStartupMetadata) error {
	return nil
}

func (service *WebhookActivationProcessor) ProcessMessage(ctx context.Context, msg redis.XMessage, isBacklogMsg bool, metadata services.ProcessMessageMetadata) error {
	// Converts the incoming stream data to a strongly typed struct
	msgData, err := messaging.ParseMessage[messaging.WebhookActivationStreamMsgData](msg)
	if err != nil {
		return err
	}

	// Activates the webhook
	maybeWebhookID, err := service.activateWebhook(ctx, msgData.WebhookID, isBacklogMsg, metadata)
	if err != nil {
		return err
	}

	// If the program is terminated AFTER the message is processed but
	// BEFORE the message is fully acknowledged (i.e. right here in the
	// code), then the transaction above will be repeated. This is not
	// problematic because the transaction is idempotent.

	// Marks this entry as completed
	return service.ack(ctx, msg, metadata, maybeWebhookID)
}

func (service *WebhookActivationProcessor) ack(ctx context.Context, msg redis.XMessage, metadata services.ProcessMessageMetadata, webhookID *string) error {
	// Acknowledges the job and deletes it from the stream in one atomic operation
	// if the webhook should not be activated
	if webhookID == nil {
		return xAckDel(
			ctx,
			service.redisClient,
			metadata.StreamName,
			metadata.ConsumerGroupName,
			msg.ID,
		)
	}

	// Acknowledges the job, deletes it from the stream, and adds it to the pending
	// set in one atomic operation
	ackScript := redis.NewScript(`
    local webhook_activation_stream_key = KEYS[1]
    local webhook_activation_stream_cg_key = KEYS[2]
    local webhook_activation_stream_msg_id = KEYS[3]
    local pending_set_key = KEYS[4]
    local pending_set_data = ARGV[1]

    redis.call("XACK", webhook_activation_stream_key, webhook_activation_stream_cg_key, webhook_activation_stream_msg_id)
    redis.call("XDEL", webhook_activation_stream_key, webhook_activation_stream_msg_id)
    redis.call("ZADD", pending_set_key, 0, pending_set_data)
  `)

	// Executes the script
	if err := ackScript.Run(ctx, service.redisClient,
		[]string{
			metadata.StreamName,
			metadata.ConsumerGroupName,
			msg.ID,
			constants.PENDING_SET_KEY,
		},
		[]any{
			messaging.NewWebhookStreamMsg(0, *webhookID, true),
		},
	).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	} else {
		return nil
	}
}

func (service *WebhookActivationProcessor) activateWebhook(ctx context.Context, webhookID string, isBacklogMsg bool, metadata services.ProcessMessageMetadata) (*string, error) {
	// Starts a transaction
	tx, err := service.mysqlClient.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return nil, err
	} else {
		defer func() {
			if err := tx.Rollback(); err != nil && !errors.Is(sql.ErrTxDone, err) {
				common.LogError(metadata.Logger, err)
			}
		}()
	}

	// Ensures that the following queries are run inside the transaction
	queries := sqlc.New(tx)

	// Finds and locks the webhook that needs to be activated
	webhook, err := queries.LockWebhook(ctx, webhookID)
	if errors.Is(sql.ErrNoRows, err) {
		metadata.Logger.Printf("Webhook with ID \"%s\" is already locked or does not exist\n", webhookID)
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// If the webhook is already active, then this means that either another consumer has
	// already activated this webhook in the past or we're retrying a failed message. In
	// the former case, we can simply ack and delete the message. In the latter case, we
	// need to retry adding the job to the pending set + ack and delete the message.
	if webhook.IsActive {
		if isBacklogMsg {
			metadata.Logger.Printf("Webhook with ID \"%s\" has already been activated - moving to pending set\n", webhookID)
			return &webhookID, nil
		} else {
			metadata.Logger.Printf("Webhook with ID \"%s\" has already been processed - ignoring\n", webhookID)
			return nil, nil
		}
	}

	// Sets the webhook's status to ACTIVE
	if _, err := queries.ActivateWebhook(ctx, webhook.ID); err != nil {
		return nil, err
	} else {
		metadata.Logger.Printf("Webhook with ID \"%s\" is now active\n", webhookID)
	}

	// Commits the transaction
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Returns the webhook ID
	return &webhookID, nil
}
