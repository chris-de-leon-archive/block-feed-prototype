package tests

import (
	"block-relay/src/libs/blockchains/flow"
	"block-relay/src/libs/consumers"
	"block-relay/src/libs/relayer"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestFlowHttpRelayer(t *testing.T) {
	// Defines helper constants
	const (
		RELAYER_REDIS_CONNECTION_URL = "host.docker.internal:6379"
		RELAYER_NETWORK_URL          = "access.devnet.nodes.onflow.org:9000"
		RELAYER_HTTP_RETRY_DELAY_MS  = "1000"
		RELAYER_HTTP_MAX_RETRIES     = "3"
		RELAYER_POLL_MS              = 2000
		TIMEOUT                      = 6000
	)

	// Defines helper variables
	var (
		counter = 0
		handler = func(w http.ResponseWriter, r *http.Request) { counter = counter + 1 }
	)

	// Creates a mock server
	server := httptest.NewServer(http.HandlerFunc(handler))
	defer server.Close()

	// Sets env variables
	t.Setenv("RELAYER_REDIS_CONNECTION_URL", RELAYER_REDIS_CONNECTION_URL)
	t.Setenv("RELAYER_HTTP_RETRY_DELAY_MS", RELAYER_HTTP_RETRY_DELAY_MS)
	t.Setenv("RELAYER_HTTP_MAX_RETRIES", RELAYER_HTTP_MAX_RETRIES)
	t.Setenv("RELAYER_POLL_MS", fmt.Sprint(RELAYER_POLL_MS))
	t.Setenv("RELAYER_NETWORK_URL", RELAYER_NETWORK_URL)
	t.Setenv("RELAYER_HTTP_URL", server.URL)

	// Creates a context that will be canceled at a later time
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(TIMEOUT)*time.Millisecond)
	defer cancel()

	// Runs the relayer in a separate go routine
	go func() {
		relayer.
			New(flow.Blockchain(os.Getenv("RELAYER_NETWORK_URL"))).
			Run(ctx, consumers.HTTPConsumer())
	}()

	// Waits for messages to be relayed
	time.Sleep(time.Duration(TIMEOUT) * time.Millisecond)

	// Checks that the correct number of http calls was made
	if counter != (TIMEOUT / RELAYER_POLL_MS) {
		t.Errorf("http endpoint was not called a sufficient number of times")
	}
}
