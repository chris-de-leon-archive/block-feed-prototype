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
)

const (
	ETH_TEST_DURATION_MS = 15000
	ETH_WSS_URL          = "wss://moonbeam-rpc.dwellir.com"
	ETH_RPC_URL          = "https://moonbeam-rpc.dwellir.com"
)

type mockEthConsumer struct {
	t          *testing.T
	prevHeight uint64
}

func (c *mockEthConsumer) ProcessData(ctx context.Context, data blockstore.BlockDocument) error {
	fmt.Printf("mock consumer received block %d\n", data.Height)
	if data.Height <= c.prevHeight {
		c.t.Fatalf("did not receive blocks in strictly ascending order (prev: %d, curr: %d)", c.prevHeight, data.Height)
	} else {
		c.prevHeight = data.Height
	}
	return nil
}

func TestEthBlockStreamer(t *testing.T) {
	ctx := context.Background()

	ethWssClient, err := testutils.GetEthClient(t, ETH_WSS_URL)
	if err != nil {
		t.Fatal(err)
	}

	ethRpcClient, err := testutils.GetEthClient(t, ETH_RPC_URL)
	if err != nil {
		t.Fatal(err)
	}

	latestBlockNum, err := ethRpcClient.BlockNumber(ctx)
	if err != nil {
		t.Fatal(err)
	} else {
		fmt.Printf("latest block = %d\n", latestBlockNum)
	}

	startHeight := latestBlockNum - 5
	streamer := etl.NewDataStreamer(
		etlproducers.NewEthBlockProducer(ethWssClient, &startHeight),
		&mockEthConsumer{
			prevHeight: startHeight - 1,
			t:          t,
		},
	)

	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(ETH_TEST_DURATION_MS)*time.Millisecond)
	defer cancel()

	if err := streamer.Run(timeoutCtx); err != nil && !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal(err)
	}
}
