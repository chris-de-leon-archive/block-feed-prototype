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
	"fmt"

	"github.com/redis/go-redis/v9"
)

type (
	WebhookLoadBalancerProcessorOpts struct {
		LockRetryAttempts       int
		LockExpBackoffInitMs    int
		LockExpBackoffMaxRandMs int
	}

	WebhookLoadBalancerProcessorParams struct {
		RedisClient *redis.Client
		MySqlClient *sql.DB
		Opts        *WebhookLoadBalancerProcessorOpts
	}

	WebhookLoadBalancerProcessor struct {
		redisClients map[string]*redis.Client
		redisClient  *redis.Client
		mysqlClient  *sql.DB
		opts         *WebhookLoadBalancerProcessorOpts
	}
)

// NOTE: multiple replicas of this service can be created
func NewWebhookLoadBalancerProcessor(params WebhookLoadBalancerProcessorParams) services.IStreamProcessor {
	return &WebhookLoadBalancerProcessor{
		redisClients: map[string]*redis.Client{},
		redisClient:  params.RedisClient,
		mysqlClient:  params.MySqlClient,
		opts:         params.Opts,
	}
}

func (service *WebhookLoadBalancerProcessor) OnStartup(ctx context.Context, metadata services.OnStartupMetadata) error {
	// Double checks that we have nodes for load balancing
	count, err := sqlc.New(service.mysqlClient).CountWebhookNodes(ctx)
	if err != nil {
		return err
	}
	if count == 0 {
		return errors.New("no webhook processing nodes exist")
	}
	return nil
}

func (service *WebhookLoadBalancerProcessor) ProcessMessage(ctx context.Context, msg redis.XMessage, isBacklogMsg bool, metadata services.ProcessMessageMetadata) error {
	// Converts the incoming stream data to a strongly typed struct
	msgData, err := messaging.ParseMessage[messaging.WebhookLoadBalancerStreamMsgData](msg)
	if err != nil {
		return err
	}

	// Defines the full consumer name
	fullConsumerName := fmt.Sprintf(
		"%s:%s",
		metadata.ConsumerGroupName,
		metadata.ConsumerName,
	)

	// Gets mysql queries
	queries := sqlc.New(service.mysqlClient)

	// NOTE: It's possible that multiple consumers may receive the same webhook ID. This can happen
	// when the API gets multiple requests from a single user to activate the same webhook before it
	// is officially activated. When multiple consumers get the same webhook ID, we do not want all
	// of them to lock different nodes for the same webhook. This will put unnecessary load on the DB
	// and block other webhooks from being processed. Instead, if multiple consumers get the same
	// webhook ID, whichever is able to claim the webhook first will be the one to process it. Any
	// consumers that aren't able to claim the webhook should discard their local copy to prevent
	// duplicate processing.
	count, err := queries.ClaimWebhook(ctx, &sqlc.ClaimWebhookParams{
		ClaimedBy: fullConsumerName,
		WebhookID: msgData.WebhookID,
	})
	if err != nil {
		return err
	}

	// Gets information on who actually claimed the webhook
	result, err := queries.FindClaimedWebhook(ctx, msgData.WebhookID)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("no claim for webhook with ID \"%s\" exists", msgData.WebhookID)
	}
	if err != nil {
		return err
	}

	// Protects against duplicate processing
	if result.Webhook.IsActive {
		metadata.Logger.Printf("Webhook with ID \"%s\" is already active - aborting", msgData.WebhookID)
		return service.ack(ctx, msg, metadata)
	}
	if result.WebhookClaim.ClaimedBy != fullConsumerName {
		metadata.Logger.Printf("Webhook with ID \"%s\" has already been claimed by consumer \"%s\" - aborting\n", msgData.WebhookID, result.WebhookClaim.ClaimedBy)
		return service.ack(ctx, msg, metadata)
	}
	if count == 0 && !isBacklogMsg {
		metadata.Logger.Printf("Webhook with ID \"%s\" has already been processed by this consumer in the past - aborting\n", msgData.WebhookID)
		return service.ack(ctx, msg, metadata)
	}

	// Stores the node that the webhook is assigned to
	var assignedNode *sqlc.WebhookNode = nil

	// Finds the node that this webhook has been assigned to (if it exists)
	node, err := queries.LocateWebhook(ctx, &sqlc.LocateWebhookParams{
		BlockchainID: result.Webhook.BlockchainID,
		WebhookID:    result.Webhook.ID,
	})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	// If the webhook hasn't been assigned to a node yet, assign it to one - if all nodes
	// are locked, retry the assignment using exponential backoff
	if errors.Is(err, sql.ErrNoRows) {
		assignedNode, err = common.ExponentialBackoff(ctx,
			service.opts.LockExpBackoffInitMs,
			service.opts.LockRetryAttempts,
			service.opts.LockExpBackoffMaxRandMs,
			func(retryCount int) (*sqlc.WebhookNode, error) {
				if n, err := service.assignWebhookToNode(ctx, result, metadata); err != nil {
					metadata.Logger.Printf("%s (attempt %d of %d)", err.Error(), retryCount, service.opts.LockRetryAttempts)
					return nil, err
				} else {
					return n, nil
				}
			},
		)
		if err != nil {
			return err
		}
	} else {
		// If we made it here then the webhook has already been assigned to a node, it is not
		// active, the current consumer is responsible for the message, and this is a backlog
		// message. Under these conditions, it still could be the case that the webhook has
		// already been added to the webhook activation stream and is currently in the middle
		// of being activated. If this is the case, then this will send a duplicate request to
		// the activation stream. However, this should be a fairly rare occurrence and even if
		// it does happen, the webhook activation stream is idempotent so adding a duplicate
		// or two won't cause any impactful issues.
		assignedNode = node
	}

	// Suppose we crash right after we assign the node, but before ACKing the message or sending it
	// to the webhook activation stream (i.e. right here in the code). In this case, once this service
	// comes back online again, it will fetch the failed job, notice that the webhook has already been
	// assigned to a node, and resend the request to the assigned node just to be safe. In this design,
	// webhook activation is idempotent, so even if the same message is added to the webhook activation
	// stream multiple times, the end result would be the same as if the message was only added once.

	// Gets the cached redis connection pool for the assigned node. If we don't already have a cached
	// connection pool then we create one and cache it for future requests.
	rc, exists := service.redisClients[assignedNode.Url]
	if !exists {
		rc = redis.NewClient(&redis.Options{
			Addr:                  assignedNode.Url,
			ContextTimeoutEnabled: true,
		})
		service.redisClients[assignedNode.Url] = rc
	}

	// JSON encodes the data for the webhook activation stream
	data, err := messaging.NewWebhookActivationStreamMsg(msgData.WebhookID).MarshalBinary()
	if err != nil {
		return err
	}

	// Forwards the message to the webhook activation stream on the assigned node for further processing
	if err := rc.XAdd(ctx, &redis.XAddArgs{
		ID:     "*",
		Stream: constants.WEBHOOK_ACTIVATION_STREAM,
		Values: map[string]any{messaging.GetDataField(): data},
	}).Err(); err != nil {
		return err
	} else {
		metadata.Logger.Printf("Webhook with ID \"%s\" has been scheduled for activation\n", msgData.WebhookID)
	}

	// Marks this entry as completed
	return service.ack(ctx, msg, metadata)
}

func (service *WebhookLoadBalancerProcessor) ack(ctx context.Context, msg redis.XMessage, metadata services.ProcessMessageMetadata) error {
	// Acknowledges the job and deletes it from the stream in one atomic operation
	return xAckDel(
		ctx,
		service.redisClient,
		metadata.StreamName,
		metadata.ConsumerGroupName,
		msg.ID,
	)
}

func (service *WebhookLoadBalancerProcessor) assignWebhookToNode(ctx context.Context, claimedWebhook *sqlc.FindClaimedWebhookRow, metadata services.ProcessMessageMetadata) (*sqlc.WebhookNode, error) {
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
	qtx := sqlc.New(tx)

	// Locks the webhook node with the least amount of webhooks skipping over locked rows
	node, err := qtx.LockWebhookNode(ctx, claimedWebhook.Webhook.BlockchainID)
	if errors.Is(sql.ErrNoRows, err) {
		return nil, errors.New("all webhook processing nodes are currently locked")
	}
	if err != nil {
		return nil, err
	}

	// Makes sure the webhook is being assigned to a node with a matching blockchain ID
	if node.BlockchainID != claimedWebhook.Webhook.BlockchainID {
		return nil, fmt.Errorf("webhook with ID \"%s\" does not have matching blockchain ID as node with ID \"%s\"", claimedWebhook.Webhook.ID, node.ID)
	}

	// Assigns the webhook to the node that is processing the fewest number of webhooks
	count, err := qtx.AssignWebhookToNode(ctx, &sqlc.AssignWebhookToNodeParams{
		WebhookClaimID: claimedWebhook.WebhookClaim.ID,
		WebhookNodeID:  node.ID,
		WebhookID:      claimedWebhook.Webhook.ID,
	})
	if err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, fmt.Errorf("failed to assign webhook with ID \"%s\" to node with ID \"%s\"", claimedWebhook.Webhook.ID, node.ID)
	}

	// Commits the transaction
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Returns the assigned node
	return node, nil
}
