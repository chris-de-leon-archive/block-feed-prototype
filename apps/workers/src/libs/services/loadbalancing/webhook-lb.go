package loadbalancing

import (
	"block-feed/src/libs/common"
	"block-feed/src/libs/db"
	"block-feed/src/libs/messaging"
	"block-feed/src/libs/sqlc"
	"block-feed/src/libs/streams"
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type (
	WebhookLoadBalancerOpts struct {
		ConsumerName            string
		Concurrency             int
		LockRetryAttempts       int
		LockExpBackoffInitMs    int
		LockExpBackoffMaxRandMs int
	}

	WebhookLoadBalancerParams struct {
		WebhookLoadBalancerStream *streams.RedisWebhookLoadBalancerStream
		Database                  *db.Database
		Opts                      *WebhookLoadBalancerOpts
	}

	WebhookLoadBalancer struct {
		redisNodes                map[string]*streams.RedisWebhookActivationStream
		webhookLoadBalancerStream *streams.RedisWebhookLoadBalancerStream
		database                  *db.Database
		opts                      *WebhookLoadBalancerOpts
	}
)

// NOTE: multiple replicas of this service can be created
func NewWebhookLoadBalancer(params WebhookLoadBalancerParams) *WebhookLoadBalancer {
	return &WebhookLoadBalancer{
		redisNodes:                map[string]*streams.RedisWebhookActivationStream{},
		webhookLoadBalancerStream: params.WebhookLoadBalancerStream,
		database:                  params.Database,
		opts:                      params.Opts,
	}
}

func (service *WebhookLoadBalancer) Run(ctx context.Context) error {
	// Double checks that we have nodes for load balancing
	count, err := service.database.Queries.CountWebhookNodes(ctx)
	if err != nil {
		return err
	}
	if count == 0 {
		return errors.New("no webhook processing nodes exist")
	}

	// Processes new messages as they arrive
	return service.webhookLoadBalancerStream.Subscribe(
		ctx,
		service.opts.ConsumerName,
		service.opts.Concurrency,
		service.handleMessage,
	)
}

func (service *WebhookLoadBalancer) handleMessage(
	ctx context.Context,
	msgID string,
	msgData *messaging.WebhookLoadBalancerStreamMsgData,
	isBacklogMsg bool,
	metadata streams.SubscribeMetadata,
) error {
	// Defines the full consumer name
	fullConsumerName := fmt.Sprintf(
		"%s:%s",
		metadata.ConsumerGroupName,
		metadata.ConsumerName,
	)

	// NOTE: It's possible that multiple consumers may receive the same webhook ID. This can happen
	// when the API gets multiple requests from a single user to activate the same webhook before it
	// is officially activated. When multiple consumers get the same webhook ID, we do not want all
	// of them to lock different nodes for the same webhook. This will put unnecessary load on the DB
	// and block other webhooks from being processed. Instead, if multiple consumers get the same
	// webhook ID, whichever is able to claim the webhook first will be the one to process it. Any
	// consumers that aren't able to claim the webhook should discard their local copy to prevent
	// duplicate processing.
	count, err := service.database.Queries.ClaimWebhook(ctx, &sqlc.ClaimWebhookParams{
		ClaimedBy: fullConsumerName,
		WebhookID: msgData.WebhookID,
	})
	if err != nil {
		return err
	}

	// Gets information on who actually claimed the webhook
	result, err := service.database.Queries.FindClaimedWebhook(ctx, msgData.WebhookID)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("no claim for webhook with ID \"%s\" exists", msgData.WebhookID)
	}
	if err != nil {
		return err
	}

	// Protects against duplicate processing
	if result.Webhook.IsActive {
		metadata.Logger.Printf("Webhook with ID \"%s\" is already active - aborting", msgData.WebhookID)
		return service.webhookLoadBalancerStream.Ack(ctx, msgID)
	}
	if result.WebhookClaim.ClaimedBy != fullConsumerName {
		metadata.Logger.Printf("Webhook with ID \"%s\" has already been claimed by consumer \"%s\" - aborting\n", msgData.WebhookID, result.WebhookClaim.ClaimedBy)
		return service.webhookLoadBalancerStream.Ack(ctx, msgID)
	}
	if count == 0 && !isBacklogMsg {
		metadata.Logger.Printf("Webhook with ID \"%s\" has already been processed by this consumer in the past - aborting\n", msgData.WebhookID)
		return service.webhookLoadBalancerStream.Ack(ctx, msgID)
	}

	// Stores the node that the webhook is assigned to
	var assignedNode *sqlc.WebhookNode = nil

	// Finds the node that this webhook has been assigned to (if it exists)
	node, err := service.database.Queries.LocateWebhook(ctx, &sqlc.LocateWebhookParams{
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
				if n, err := service.assignWebhookToNode(ctx, result); err != nil {
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
	redisNode, exists := service.redisNodes[assignedNode.Url]
	if !exists {
		redisNode = streams.NewRedisWebhookActivationStream(
			redis.NewClient(&redis.Options{
				Addr:                  assignedNode.Url,
				ContextTimeoutEnabled: true,
			}),
		)
		service.redisNodes[assignedNode.Url] = redisNode
	}

	// Forwards the message to the webhook activation stream on the assigned node for further processing
	if err := redisNode.AddOne(ctx, messaging.NewWebhookActivationStreamMsg(msgData.WebhookID)); err != nil {
		return err
	} else {
		metadata.Logger.Printf("Webhook with ID \"%s\" has been scheduled for activation\n", msgData.WebhookID)
	}

	// Marks this entry as completed
	return service.webhookLoadBalancerStream.Ack(ctx, msgID)
}

func (service *WebhookLoadBalancer) assignWebhookToNode(ctx context.Context, claimedWebhook *sqlc.FindClaimedWebhookRow) (*sqlc.WebhookNode, error) {
	// Defines a variable which stores the node that this webhook was/is assigned to
	var assignedNode *sqlc.WebhookNode = nil

	// Wraps the following logic in a database transaction
	err := service.database.WithTx(ctx,
		func(queries *sqlc.Queries) error {
			// Locks the webhook node with the least amount of webhooks skipping over locked rows
			node, err := queries.LockWebhookNode(ctx, claimedWebhook.Webhook.BlockchainID)
			if errors.Is(sql.ErrNoRows, err) {
				return errors.New("all webhook processing nodes are currently locked")
			}
			if err != nil {
				return err
			}

			// Makes sure the webhook is being assigned to a node with a matching blockchain ID
			if node.BlockchainID != claimedWebhook.Webhook.BlockchainID {
				return fmt.Errorf("webhook with ID \"%s\" does not have matching blockchain ID as node with ID \"%s\"", claimedWebhook.Webhook.ID, node.ID)
			}

			// Assigns the webhook to the node that is processing the fewest number of webhooks
			count, err := queries.AssignWebhookToNode(ctx, &sqlc.AssignWebhookToNodeParams{
				WebhookClaimID: claimedWebhook.WebhookClaim.ID,
				WebhookNodeID:  node.ID,
				WebhookID:      claimedWebhook.Webhook.ID,
			})
			if err != nil {
				return err
			}
			if count == 0 {
				return fmt.Errorf("failed to assign webhook with ID \"%s\" to node with ID \"%s\"", claimedWebhook.Webhook.ID, node.ID)
			}

			// Assigns the node
			assignedNode = node

			// Returns nil if no errors occurred
			return nil
		},
		&sql.TxOptions{},
	)

	// Returns the results
	return assignedNode, err
}
