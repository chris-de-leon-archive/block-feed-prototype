package processing

import (
	"block-feed/src/libs/common"
	"block-feed/src/libs/messaging"
	"block-feed/src/libs/sqlc"
	"block-feed/src/libs/streaming"
	"context"
	"database/sql"
	"errors"
)

type (
	WebhookActivatorOpts struct {
		ConsumerName string
		Concurrency  int
	}

	WebhookActivatorParams struct {
		WebhookActivationStream *streaming.RedisWebhookActivationStream
		MySqlClient             *sql.DB
		Opts                    *WebhookActivatorOpts
	}

	WebhookActivator struct {
		webhookActivationStream *streaming.RedisWebhookActivationStream
		mysqlClient             *sql.DB
		opts                    *WebhookActivatorOpts
	}
)

// NOTE: multiple replicas of this service can be created
func NewWebhookActivator(params WebhookActivatorParams) *WebhookActivator {
	return &WebhookActivator{
		webhookActivationStream: params.WebhookActivationStream,
		mysqlClient:             params.MySqlClient,
		opts:                    params.Opts,
	}
}

func (service *WebhookActivator) Run(ctx context.Context) error {
	return service.webhookActivationStream.Subscribe(
		ctx,
		service.opts.ConsumerName,
		service.opts.Concurrency,
		service.handleMessage,
	)
}

func (service *WebhookActivator) handleMessage(
	ctx context.Context,
	msgID string,
	msgData *messaging.WebhookActivationStreamMsgData,
	isBacklogMsg bool,
	metadata streaming.SubscribeMetadata,
) error {
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
	return service.webhookActivationStream.Ack(ctx, msgID, maybeWebhookID)
}

func (service *WebhookActivator) activateWebhook(ctx context.Context, webhookID string, isBacklogMsg bool, metadata streaming.SubscribeMetadata) (*string, error) {
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
