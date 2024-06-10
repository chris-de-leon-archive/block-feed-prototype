package blockrelay

import (
	"blockstore"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"queries"
	"streams"
	"time"
)

type (
	BlockRelayOpts struct {
		ConsumerName string
		Concurrency  int
	}

	BlockRelayParams struct {
		WebhookStream *streams.WebhookStream
		BlockStore    blockstore.IBlockStore
		Queries       *queries.Queries
		Opts          *BlockRelayOpts
	}

	BlockRelay struct {
		webhookStream *streams.WebhookStream
		blockStore    blockstore.IBlockStore
		Queries       *queries.Queries
		opts          *BlockRelayOpts
	}
)

func NewBlockRelay(params BlockRelayParams) *BlockRelay {
	return &BlockRelay{
		webhookStream: params.WebhookStream,
		blockStore:    params.BlockStore,
		Queries:       params.Queries,
		opts:          params.Opts,
	}
}

func (service *BlockRelay) Run(ctx context.Context) error {
	// NOTE: all webhooks that this processor deals with must have the same chain ID.
	// In other words, webhook processors cannot mix and match messages that are related
	// to different chains. This is because the redis instance that this processor is
	// connected to assumes that all the block heights it sees are tied to the same chain.
	// This means that if this processor gets one webhook tied to the Flow blockchain and
	// later it gets a different webhook tied to the Ethereum blockchain, then the block
	// heights for each of these chains will most likely be drastically different, yet
	// they will still be stored in redis. As a result, block flushing will not work
	// correctly.
	return service.webhookStream.Subscribe(
		ctx,
		service.opts.ConsumerName,
		service.opts.Concurrency,
		1, // each consumer should only process 1 message / webhook at a time
		service.handleMessages,
	)
}

func (service *BlockRelay) handleMessages(
	ctx context.Context,
	msgs []streams.ParsedStreamMessage[streams.WebhookStreamMsgData],
	isBacklogMsg bool,
	metadata streams.SubscribeMetadata,
) error {
	// Exits early if there are no messages
	if len(msgs) == 0 {
		return nil
	}

	// Gets the message (there should only be 1)
	msg := msgs[0]

	// Gets the webhook data - if it no longer exists then this
	// message will be ACK'd + deleted and we can exit early
	webhook, err := service.Queries.WebhooksFindOne(ctx, msg.Data.WebhookID)
	if errors.Is(err, sql.ErrNoRows) {
		return service.webhookStream.XAckDel(ctx, msg, nil)
	}
	if err != nil {
		return err
	}

	// If the current message is a backlog message, then we should check
	// the number of times it has been retried and take action accordingly
	if isBacklogMsg {
		// Gets the pending data for this message
		pendingMsg, err := service.webhookStream.GetPendingMsg(ctx, metadata.ConsumerName, msg.ID)
		if err != nil {
			return err
		}

		// If the current retry count exceeds the XMaxRetries limit, then move onto a different range of blocks
		if pendingMsg.RetryCount >= int64(webhook.MaxRetries) {
			// TODO: is there a better way to handle repeated errors?
			return service.webhookStream.XAckDel(
				ctx,
				msg,
				streams.NewWebhookStreamMsg(
					msg.Data.WebhookID,
					msg.Data.BlockHeight+1, // if we could not process [h1, h2], try [h1+1, h2+1]
					false,
				),
			)
		}
	}

	// If we're under the retry limit, then get the relevant blocks from the block store
	var blocks []blockstore.BlockDocument
	if msg.Data.IsNew {
		blocks, err = service.blockStore.GetLatestBlocks(
			ctx,
			webhook.BlockchainID,
			int64(webhook.MaxBlocks),
		)
	} else {
		blocks, err = service.blockStore.GetBlocks(
			ctx,
			webhook.BlockchainID,
			msg.Data.BlockHeight,
			msg.Data.BlockHeight+uint64(webhook.MaxBlocks)-1,
		)
	}

	// Handles any errors fetching the blocks from the block store
	if err != nil {
		return err
	}

	// Logs the number of blocks retrieved from the block store
	if msg.Data.IsNew {
		metadata.Logger.Printf("Received %d block(s) from block store for new message", len(blocks))
	} else {
		metadata.Logger.Printf("Received %d block(s) from block store for height %d", len(blocks), msg.Data.BlockHeight)
	}

	// NOTE: if there are no blocks to send, then this means 1 of 2 things:
	// 1. We're trying to query a range in the future that we haven't stored
	//    yet (i.e. the block height in the message data is larger than the
	//    largest block height in the block store). This should never happen,
	//    and even if it does, the code as it is now will handle it properly.
	//    In this case, we can add the current message back to the pending set
	//    where it will remain idle until new blocks arrive for it.
	// 2. We're trying to query a range that's too far in the past. In this case,
	//    the blocks have been evicted from the store (e.g. if using a redis-backed
	//    block store, then this can happen when we reach memory limits). This
	//    situation is more difficult to account for and will lead to the same
	//    job being processed infinitely at the same block height. We need to
	//    ensure we have a safe way to only evict blocks we know won't be used
	//    by any message instead of having them be evicted automatically.
	//
	// TODO: we need protection for case #2 - would it be worth it to check if
	// a job has a height that is less than the smallest height in the cache and
	// skip blocks?
	if len(blocks) == 0 {
		panic("unexpectedly received 0 blocks from block store")
	}

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
	}

	// If the program is terminated AFTER the message is processed but
	// BEFORE the message is fully acknowledged (i.e. right here in the
	// code), then the client will receive the same request multiple times.

	// Stores the start height for the new range of blocks we need to send to the
	// webhook URL the next time this message is re-added to the stream
	nextBlockHeight := blocks[len(blocks)-1].Height + 1

	// Marks this entry as completed
	return service.webhookStream.XAckDel(
		ctx,
		msg,
		streams.NewWebhookStreamMsg(
			msg.Data.WebhookID,
			nextBlockHeight,
			false,
		),
	)
}
