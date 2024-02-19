package processors

import (
	"block-relay/src/libs/blockstore"
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
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

type (
	WebhookProcessorParams struct {
		BlockStore     blockstore.IBlockStore
		DatabaseClient *sql.DB
		RedisClient    *redis.Client
	}

	WebhookProcessor struct {
		blockStore  blockstore.IBlockStore
		redisClient *redis.Client
		dbClient    *sql.DB
		dbQueries   *sqlc.Queries
	}
)

// NOTE: multiple replicas of this service can be created
func NewWebhookProcessor(params WebhookProcessorParams) services.IStreamProcessor {
	return &WebhookProcessor{
		redisClient: params.RedisClient,
		blockStore:  params.BlockStore,
		dbClient:    params.DatabaseClient,
		dbQueries:   sqlc.New(params.DatabaseClient),
	}
}

func (service *WebhookProcessor) OnStartup(ctx context.Context, metadata services.OnStartupMetadata) error {
	return nil
}

func (service *WebhookProcessor) ProcessMessage(ctx context.Context, msg redis.XMessage, isBacklogMsg bool, metadata services.ProcessMessageMetadata) error {
	// Converts the incoming stream data to a strongly typed struct
	msgData, err := messaging.ParseMessage[messaging.WebhookStreamMsgData](msg)
	if err != nil {
		return err
	}

	// NOTE: all webhooks that this processor deals with must have the same chain ID.
	// In other words, webhook processors cannot mix and match messages that are related
	// to different chains. This is because the redis instance that this processor is
	// connected to assumes that all the block heights it sees are tied to the same chain.
	// This means that if this processor gets one webhook tied to the Flow blockchain and
	// later it gets a different webhook tied to the Ethereum blockchain, then the block
	// heights for each of these chains will most likely be drastically different, yet
	// they will still be stored in redis. As a result, block flushing will not work
	// correctly.

	// Gets the webhook data - if it is no longer in the database then this
	// stream entry will be ACK'd + deleted and we can exit early
	webhook, err := service.dbQueries.GetWebhook(ctx, msgData.WebhookID)
	if errors.Is(err, sql.ErrNoRows) {
		return service.ack(ctx, msg, nil, metadata)
	}
	if err != nil {
		return err
	}

	// If the current message is a backlog message, then we should check
	// the number of times it has been retried and take action accordingly
	if isBacklogMsg {
		// Gets the pending data for this message
		pendingMsgs, err := service.redisClient.XPendingExt(ctx, &redis.XPendingExtArgs{
			Stream:   metadata.StreamName,
			Group:    metadata.ConsumerGroupName,
			Consumer: metadata.ConsumerName,
			Start:    msg.ID,
			End:      msg.ID,
			Count:    1,
		}).Result()
		if err != nil {
			return err
		}

		// Reports an error if we received no pending message data
		if len(pendingMsgs) != 1 {
			return fmt.Errorf("received an unexpected number of pending messages: %v", pendingMsgs)
		}

		// Checks that the pending message ID is the same as the ID of the message we're processing
		pendingMsg := pendingMsgs[0]
		if msg.ID != pendingMsg.ID {
			return fmt.Errorf("claimed message ID \"%s\" differs from pending message ID \"%s\"", msg.ID, pendingMsg.ID)
		}

		// If the current retry count exceeds the XMaxRetries limit, then move onto a different range of blocks
		if pendingMsg.RetryCount >= int64(webhook.MaxRetries) {
			// TODO: is there a better way to handle repeated errors?
			return service.ack(ctx, msg,
				messaging.NewWebhookStreamMsg(
					msgData.BlockHeight+1, // if we could not process [h1, h2], try [h1+1, h2+1]
					msgData.WebhookID,
					false,
				),
				metadata,
			)
		}
	}

	// If we're under the retry limit, then get the relevant blocks from the block store
	var blocks []blockstore.BlockDocument
	if msgData.IsNew {
		blocks, err = service.blockStore.GetLatestBlocks(ctx,
			webhook.BlockchainID,
			int64(webhook.MaxBlocks),
		)
	} else {
		blocks, err = service.blockStore.GetBlocks(ctx,
			webhook.BlockchainID,
			msgData.BlockHeight,
			msgData.BlockHeight+uint64(webhook.MaxBlocks)-1,
		)
	}

	// Handles any errors fetching the blocks from the block store
	if err != nil {
		return err
	}

	// Logs the number of blocks retrieved from the block store
	if msgData.IsNew {
		metadata.Logger.Printf("Received %d block(s) from block store for new message", len(blocks))
	} else {
		metadata.Logger.Printf("Received %d block(s) from block store for height %d", len(blocks), msgData.BlockHeight)
	}

	// NOTE: if there are no blocks to send, then this means 1 of 2 things:
	// 1. We're trying to query a range in the future that we haven't stored
	//    yet (i.e. the block height in the message data is larger than the
	//    largest block height in the block store). This should never happen,
	//    and even if it does, the code as it is now will handle it properly.
	//    In this case, we can add the current message back to the pending set
	//    where it will remain idle until new blocks arrive for it.
	// 2. We're trying to query a range too far in the past. In this case, the
	//    blocks have been evicted from the store (e.g. if using a redis-backed
	//    block store, then this can happen when we reach memory limits). This
	//    situation is more difficult to account for and will lead to the same
	//    job being processed infinitely at the same block height. We need to
	//    ensure we have a safe way to only evict blocks we know won't be used
	//    by any message instead of having them be evicted automatically.

	// TODO: we need protection for case #2 - would it be worth it to check if
	// a job has a height that is less than the smallest height in the cache and
	// skip blocks?

	// Stores the start height for the new range of blocks we need to send to the
	// webhook URL the next time this message is re-added to the stream
	nextBlockHeight := msgData.BlockHeight

	// Sends a request to the webhook endpoint only if there are blocks to send
	if len(blocks) > 0 {
		// Extracts the relevant block data
		decodedBlocks := make([]string, len(blocks))
		for i, b := range blocks {
			decodedBlocks[i] = string(b.Data)
		}

		// JSON encodes all the block data
		body, err := json.MarshalIndent(decodedBlocks, "", " ")
		if err != nil {
			return err
		}

		// Prepares a context aware POST request with all the blocks included in the payload
		req, err := http.NewRequestWithContext(ctx, "POST", webhook.Url, bytes.NewBuffer(body))
		if err != nil {
			return err
		} else {
			req.Header.Set("Content-Type", "application/json")
		}

		// Sends a synchronous POST request to the webhook URL, this is the
		// only non-idempotent operation in this function
		httpClient := http.Client{Timeout: time.Duration(webhook.TimeoutMs) * time.Millisecond}
		if _, err := httpClient.Do(req); err != nil {
			return err
		} else {
			nextBlockHeight = blocks[len(blocks)-1].Height + 1
		}
	}

	// If the program is terminated AFTER the message is processed but
	// BEFORE the message is fully acknowledged (i.e. right here in the
	// code), then the client will receive the same request multiple times.

	// Marks this entry as completed
	return service.ack(ctx, msg,
		messaging.NewWebhookStreamMsg(
			nextBlockHeight,
			msgData.WebhookID,
			false,
		),
		metadata,
	)
}

func (service *WebhookProcessor) ack(ctx context.Context, msg redis.XMessage, newMsg *messaging.StreamMessage[messaging.WebhookStreamMsgData], metadata services.ProcessMessageMetadata) error {
	if newMsg == nil {
		// Acknowledges the job and deletes it from the stream in one atomic operation
		ackScript := redis.NewScript(`
      local webhook_stream_key = KEYS[1]
      local webhook_stream_cg_key = KEYS[2]
      local webhook_stream_old_msg_id = KEYS[3]

      redis.call("XACK", webhook_stream_key, webhook_stream_cg_key, webhook_stream_old_msg_id)
      redis.call("XDEL", webhook_stream_key, webhook_stream_old_msg_id)
    `)

		// Executes the script
		if err := ackScript.Run(ctx, service.redisClient,
			[]string{
				metadata.StreamName,
				metadata.ConsumerGroupName,
				msg.ID,
			},
			[]any{},
		).Err(); err != nil && !errors.Is(err, redis.Nil) {
			return err
		}
	} else {
		// Acknowledges the job, deletes it from the stream, and either reschedules
		// the job or adds it to the pending set in one atomic operation
		ackScript := redis.NewScript(`
      local latest_block_height_key = KEYS[1]
      local pending_set_key = KEYS[2]
      local webhook_stream_key = KEYS[3]
      local webhook_stream_cg_key = KEYS[4]
      local webhook_stream_msg_data_field = KEYS[5]
      local webhook_stream_old_msg_id = KEYS[6]
      local new_block_height = tonumber(ARGV[1])
      local webhook_stream_new_msg_data = ARGV[2]

      redis.call("XACK", webhook_stream_key, webhook_stream_cg_key, webhook_stream_old_msg_id)
      redis.call("XDEL", webhook_stream_key, webhook_stream_old_msg_id)

      local latest_block_height = redis.call("GET", latest_block_height_key)
      if latest_block_height == false then
        redis.call("ZADD", pending_set_key, new_block_height, webhook_stream_new_msg_data)
        return
      end

      if new_block_height >= tonumber(latest_block_height) then
        redis.call("ZADD", pending_set_key, new_block_height, webhook_stream_new_msg_data)
      else
        redis.call("XADD", webhook_stream_key, "*", webhook_stream_msg_data_field, webhook_stream_new_msg_data)
      end
    `)

		// Executes the script
		if err := ackScript.Run(ctx, service.redisClient,
			[]string{
				constants.LATEST_BLOCK_HEIGHT_KEY,
				constants.PENDING_SET_KEY,
				metadata.StreamName,
				metadata.ConsumerGroupName,
				messaging.GetDataField(),
				msg.ID,
			},
			[]any{
				newMsg.Data.BlockHeight,
				newMsg,
			},
		).Err(); err != nil && !errors.Is(err, redis.Nil) {
			return err
		}
	}

	// Returns nil if no errors occurred
	return nil
}
