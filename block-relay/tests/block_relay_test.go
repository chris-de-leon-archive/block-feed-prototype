package tests

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/lib"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestBlockRelay(t *testing.T) {
	// Defines helper constants
	const (
		BLOCK_PRODUCER_POLL_MS       = "1000"
		BLOCK_SPLITTER_NAME          = "block-splitter-flow-testnet"
		BLOCK_CONSUMER_NAME          = "block-consumer"
		BLOCK_CONSUMER_MAX_POOL_SIZE = "3"
		REDIS_CACHE_TTL_MS           = "10000"
		REDIS_MAX_KEYS               = "100"
		REDIS_VERSION                = "7.2.1-alpine3.18"
		RMQ_WEBHOOK_QUEUE_NAME       = "webhook-jobs"
		RMQ_VERSION                  = "3.12.12-alpine"
		CHAIN_URL                    = "access.devnet.nodes.onflow.org:9000"
		CHAIN_ID                     = blockchains.FLOW_TESTNET
		TEST_DURATION_MS             = 10000
	)

	// Defines helper variables
	var (
		counter = 0
		handler = func(_ http.ResponseWriter, _ *http.Request) { counter = counter + 1 }
		ctx     = context.Background()
	)

	// Starts a mock server
	server := httptest.NewServer(http.HandlerFunc(handler))
	defer server.Close()

	// Starts a redis container
	redisC, err := NewRedisContainer(ctx, t, REDIS_VERSION)
	if err != nil {
		t.Error(err)
	}

	// Starts a rabbit mq container
	rabbitmqC, err := NewRabbitMQContainer(ctx, t, RMQ_VERSION)
	if err != nil {
		t.Error(err)
	}

	// Creates a context that will be canceled at a later time
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(TEST_DURATION_MS)*time.Millisecond)
	defer cancel()

	// Runs the producer in a separate go routine
	go func() {
		resolver := blockchains.NewChainResolver()
		defer resolver.Close()

		chain, err := resolver.ResolveChain(blockchains.BlockchainOpts{
			ConnectionURL: CHAIN_URL,
			ChainID:       CHAIN_ID,
		})
		if err != nil {
			t.Error(err)
		}

		t.Setenv("BLOCKCHAIN_CONNECTION_URL", CHAIN_URL)
		t.Setenv("BLOCKCHAIN_ID", string(CHAIN_ID))
		t.Setenv("BLOCK_PRODUCER_STREAM_URL", rabbitmqC.Stream.Url)
		t.Setenv("BLOCK_PRODUCER_POLL_MS", BLOCK_PRODUCER_POLL_MS)

		err = lib.RunBlockProducer(timeoutCtx, chain)
		if err != nil {
			t.Error(err)
		}
	}()

	// Runs the splitter in a separate go routine
	go func() {
		t.Setenv("BLOCK_SPLITTER_STREAM_URL", rabbitmqC.Stream.Url)
		t.Setenv("BLOCK_SPLITTER_STREAM_NAME", string(CHAIN_ID))
		t.Setenv("BLOCK_SPLITTER_QUEUE_URL", rabbitmqC.Amqp.Url)
		t.Setenv("BLOCK_SPLITTER_QUEUE_NAME", RMQ_WEBHOOK_QUEUE_NAME)
		t.Setenv("BLOCK_SPLITTER_NAME", BLOCK_SPLITTER_NAME)

		err := lib.RunBlockSplitter(timeoutCtx)
		if err != nil {
			t.Error(err)
		}
	}()

	// Runs the consumer in a separate go routine
	go func() {
		t.Setenv("REDIS_CACHE_CONNECTION_URL", redisC.Cache.Url)
		t.Setenv("REDIS_CACHE_MAX_KEYS", REDIS_MAX_KEYS)
		t.Setenv("REDIS_CACHE_TTL_MS", REDIS_CACHE_TTL_MS)
		t.Setenv("BLOCK_CONSUMER_QUEUE_URL", rabbitmqC.Amqp.Url)
		t.Setenv("BLOCK_CONSUMER_QUEUE_NAME", RMQ_WEBHOOK_QUEUE_NAME)
		t.Setenv("BLOCK_CONSUMER_MAX_POOL_SIZE", BLOCK_CONSUMER_MAX_POOL_SIZE)
		t.Setenv("BLOCK_CONSUMER_NAME", BLOCK_CONSUMER_NAME)

		err := lib.RunBlockConsumer(timeoutCtx)
		if err != nil {
			t.Error(err)
		}
	}()

	// Waits for the timeout context to finish (messages should be processed in the background)
	<-timeoutCtx.Done()

	// // Checks that the correct number of http calls was made
	// if counter != (TEST_DURATION_MS / BLOCK_PRODUCER_POLL_MS) {
	// 	t.Errorf("http endpoint was not called a sufficient number of times")
	// }
}
