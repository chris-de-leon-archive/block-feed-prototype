package flowsrc

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/chris-de-leon/block-feed-prototype/block-stores/blockstore"
	"github.com/chris-de-leon/block-feed-prototype/testutils/clients/flow"

	"github.com/onflow/flow-go-sdk/access/grpc"
)

const FLOW_TEST_DURATION_MS = 5000

type mockFlowConsumer struct {
	t          *testing.T
	prevHeight uint64
}

func (c *mockFlowConsumer) ProcessData(ctx context.Context, data blockstore.BlockDocument) error {
	fmt.Printf("mock consumer received block %d\n", data.Height)
	if data.Height <= c.prevHeight {
		c.t.Fatalf("did not receive blocks in strictly ascending order (prev: %d, curr: %d)", c.prevHeight, data.Height)
	} else {
		c.prevHeight = data.Height
	}
	return nil
}

func TestFlowBlockStreamer(t *testing.T) {
	ctx := context.Background()

	flowClient, err := flow.GetFlowClient(t, grpc.TestnetHost)
	if err != nil {
		t.Fatal(err)
	}

	latestBlock, err := flowClient.GetLatestBlock(ctx, true)
	if err != nil {
		t.Fatal(err)
	} else {
		fmt.Printf("latest block = %d\n", latestBlock.Height)
	}

	startHeight := latestBlock.Height - 5
	streamer := func(ctx context.Context) error {
		p := NewFlowBlockSource(
			flowClient,
			&startHeight,
			&FlowBlockSourceOpts{},
		)
		c := &mockFlowConsumer{
			prevHeight: startHeight - 1,
			t:          t,
		}
		return p.Subscribe(ctx, c.ProcessData)
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(FLOW_TEST_DURATION_MS)*time.Millisecond)
	defer cancel()

	if err := streamer(timeoutCtx); err != nil && !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal(err)
	}
}
