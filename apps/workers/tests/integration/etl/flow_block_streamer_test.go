package integration

import (
	"block-feed/src/libs/blockstore"
	"block-feed/src/libs/services/etl"
	etlproducers "block-feed/src/libs/services/etl/producers"
	"block-feed/tests/testutils"
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

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

	flowClient, err := testutils.GetFlowClient(t, grpc.TestnetHost)
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
	streamer := etl.NewDataStreamer(
		etlproducers.NewFlowBlockProducer(
			flowClient,
			&startHeight,
			&etlproducers.FlowBlockProducerOpts{},
		),
		&mockFlowConsumer{
			prevHeight: startHeight - 1,
			t:          t,
		},
	)

	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(FLOW_TEST_DURATION_MS)*time.Millisecond)
	defer cancel()

	if err := streamer.Run(timeoutCtx); err != nil && !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal(err)
	}
}
