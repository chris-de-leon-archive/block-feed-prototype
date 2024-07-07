package redistore

import (
	"blockstore"
	"context"
	"testing"
	"testutils"
)

func TestRedisBlockStore(t *testing.T) {
	// Defines helper variables
	const chainID = "dummy-chain"
	ctx := context.Background()

	// Creates some fake blocks
	blocks := make([]blockstore.BlockDocument, 3)
	blocks[0] = blockstore.BlockDocument{Height: 1, Data: []byte{}}
	blocks[1] = blockstore.BlockDocument{Height: 2, Data: []byte{}}
	blocks[2] = blockstore.BlockDocument{Height: 3, Data: []byte{}}

	// Starts a container
	container, err := testutils.NewRedisContainer(ctx, t, testutils.RedisDefaultCmd())
	if err != nil {
		t.Fatal(err)
	}

	// Creates a client
	client, err := testutils.GetRedisClient(t, container.Conn.Url)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a block store
	blockStore := NewRedisBlockStore(client)

	// Initializes the block store
	t.Run("Init Block Store", func(t *testing.T) {
		if err := blockStore.Init(ctx, chainID); err != nil {
			t.Fatal(err)
		}
	})

	// Initializes the block store again (should do nothing)
	t.Run("Init Block Store (idempotent)", func(t *testing.T) {
		if err := blockStore.Init(ctx, chainID); err != nil {
			t.Fatal(err)
		}
	})

	// Adds some blocks to the store
	t.Run("Put Blocks", func(t *testing.T) {
		err := blockStore.PutBlocks(ctx, chainID, blocks)
		if err != nil {
			t.Fatal(err)
		}

		count, err := client.ZCard(ctx, chainID).Result()
		if err != nil {
			t.Fatal(err)
		}
		if count != int64(len(blocks)) {
			t.Fatalf("Expected %d elements to be in the store but got %d", len(blocks), count)
		}
	})

	// Adds the same blocks to the store (should do nothing)
	t.Run("Put Blocks (idempotent)", func(t *testing.T) {
		err := blockStore.PutBlocks(ctx, chainID, blocks)
		if err != nil {
			t.Fatal(err)
		}

		count, err := client.ZCard(ctx, chainID).Result()
		if err != nil {
			t.Fatal(err)
		}
		if count != int64(len(blocks)) {
			t.Fatalf("Expected %d elements to be in the store but got %d", len(blocks), count)
		}
	})

	// Gets blocks with a height in the inclusive range: [2, 3]
	t.Run("Get Blocks", func(t *testing.T) {
		data, err := blockStore.GetBlocks(ctx, chainID, 2, 3)
		if err != nil {
			t.Fatal(err)
		}
		if len(data) != 2 {
			t.Fatalf("Expected exactly 2 blocks to be returned but received %d", len(data))
		}
		if data[0].Height > data[1].Height {
			t.Fatalf("Expected data to be in ascending order of block height: %v", data)
		}
		if data[0].Height != blocks[1].Height {
			t.Fatalf("Element at index 0 is incorrect - expected %v but got %v", blocks[1], data[0])
		}
		if data[1].Height != blocks[2].Height {
			t.Fatalf("Element at index 1 is incorrect - expected %v but got %v", blocks[2], data[1])
		}
	})

	// Gets the latest two blocks
	t.Run("Get Latest Blocks", func(t *testing.T) {
		data, err := blockStore.GetLatestBlocks(ctx, chainID, 2)
		if err != nil {
			t.Fatal(err)
		}
		if len(data) != 2 {
			t.Fatalf("Expected exactly 2 blocks to be returned but received %d", len(data))
		}
		if data[0].Height < data[1].Height {
			t.Fatalf("Expected data to be in descending order of block height: %v", data)
		}
		if data[0].Height != blocks[2].Height {
			t.Fatalf("Element at index 0 is incorrect - expected %v but got %v", blocks[2], data[0])
		}
		if data[1].Height != blocks[1].Height {
			t.Fatalf("Element at index 1 is incorrect - expected %v but got %v", blocks[1], data[1])
		}
	})

	// Gets the latest block
	t.Run("Get Latest Block", func(t *testing.T) {
		data, err := blockStore.GetLatestBlock(ctx, chainID)
		if err != nil {
			t.Fatal(err)
		}
		if data.Height != blocks[2].Height {
			t.Fatalf("Expected %v but got %v", blocks[2], data)
		}
	})
}
