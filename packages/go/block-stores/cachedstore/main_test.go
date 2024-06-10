package cachedstore

import (
	"blockstore"
	"context"
	"errors"
	"math"
	"redistore"
	"testing"
	"testutils"
	"time"
	"timescalestore"

	"golang.org/x/sync/errgroup"
)

func TestRedisOptimizedBlockStore(t *testing.T) {
	// Defines helper variables
	const chainID = "dummy-chain"
	ctx := context.Background()

	// Creates some fake blocks
	blocks := make([]blockstore.BlockDocument, 3)
	blocks[0] = blockstore.BlockDocument{Height: 1, Data: []byte{}}
	blocks[1] = blockstore.BlockDocument{Height: 2, Data: []byte{}}
	blocks[2] = blockstore.BlockDocument{Height: 3, Data: []byte{}}

	// Defines an additional block which will be added later
	extraBlock := blockstore.BlockDocument{Height: 4, Data: []byte{}}

	// Defines options for flushing blocks
	flushOpts := RedisOptimizedBlockStoreFlushOpts{
		IntervalMs: math.MaxInt, // doesn't matter
		Threshold:  len(blocks),
	}

	// Creates an errgroup to start containers in parallel
	eg := new(errgroup.Group)
	var cTimescale *testutils.ContainerWithConnectionInfo
	var cRedis *testutils.ContainerWithConnectionInfo

	// Starts a timescale container
	eg.Go(func() error {
		container, err := testutils.NewTimescaleDBContainer(ctx, t)
		if err != nil {
			return err
		} else {
			cTimescale = container
		}
		return nil
	})

	// Starts a redis container
	eg.Go(func() error {
		container, err := testutils.NewRedisContainer(ctx, t, testutils.RedisBlockStoreCmd())
		if err != nil {
			return err
		} else {
			cRedis = container
		}
		return nil
	})

	// Waits for all the containers to be created
	if err := eg.Wait(); err != nil {
		t.Fatal(err)
	}

	// Creates a postgres client
	pgClient, err := testutils.GetPostgresClient(t, ctx, cTimescale.Conn.Url)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a redis client
	redisClient, err := testutils.GetRedisClient(t, cRedis.Conn.Url)
	if err != nil {
		t.Fatal(err)
	}

	// Creates a block store
	blockStore := NewRedisOptimizedBlockStore(
		timescalestore.NewTimescaleBlockStore(pgClient),
		redistore.NewRedisBlockStore(redisClient),
	)

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

	//////////////////
	// Test Caching //
	//////////////////

	// Adds some blocks to the store
	t.Run("Put Blocks", func(t *testing.T) {
		err := blockStore.PutBlocks(ctx, chainID, blocks)
		if err != nil {
			t.Fatal(err)
		}

		count, err := redisClient.ZCard(ctx, chainID).Result()
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

		count, err := redisClient.ZCard(ctx, chainID).Result()
		if err != nil {
			t.Fatal(err)
		}
		if count != int64(len(blocks)) {
			t.Fatalf("Expected %d elements to be in the redis store but got %d", len(blocks), count)
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

	///////////////////
	// Test Flushing //
	///////////////////

	// Creates a timeout context
	flushCtx, cancel := context.WithTimeout(ctx, time.Duration(100)*time.Millisecond)
	defer cancel()

	// Flushes the blocks from the cache to the database once
	eg.Go(func() error {
		if err := blockStore.StartFlushing(flushCtx, chainID, flushOpts); err != nil && !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, context.Canceled) {
			return err
		}
		return nil
	})

	// Wait for the context to be canceled (which should be enough time for the blocks to be flushed)
	if err := eg.Wait(); err != nil {
		t.Fatal(err)
	}

	// Checks that the cache was flushed
	t.Run("Blocks Flushed", func(t *testing.T) {
		count, err := redisClient.ZCard(ctx, chainID).Result()
		if err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatalf("Expected %d elements to be flushed from the redis store, but %d exist", len(blocks), count)
		}
	})

	// Gets blocks with a height in the inclusive range: [2, 3]
	t.Run("Get Blocks from Wrapped Store", func(t *testing.T) {
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
	t.Run("Get Latest Blocks from Wrapped Store", func(t *testing.T) {
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
	t.Run("Get Latest Block from Wrapped Store", func(t *testing.T) {
		data, err := blockStore.GetLatestBlock(ctx, chainID)
		if err != nil {
			t.Fatal(err)
		}
		if data.Height != blocks[2].Height {
			t.Fatalf("Expected %v but got %v", blocks[2], data)
		}
	})

	/////////////////////////////////////////////////////
	// Test Querying When Data is Split Between Stores //
	/////////////////////////////////////////////////////

	// Adds a new block to the store
	t.Run("Put Extra Block", func(t *testing.T) {
		err := blockStore.PutBlocks(ctx, chainID, []blockstore.BlockDocument{extraBlock})
		if err != nil {
			t.Fatal(err)
		}

		count, err := redisClient.ZCard(ctx, chainID).Result()
		if err != nil {
			t.Fatal(err)
		}
		if count != 1 {
			t.Fatalf("Expected %d elements to be in the redis store but got %d", 1, count)
		}
	})

	// Gets blocks with a height in the inclusive range: [1, 4]
	t.Run("Get Blocks from both Stores", func(t *testing.T) {
		data, err := blockStore.GetBlocks(ctx, chainID, 1, 4)
		if err != nil {
			t.Fatal(err)
		}
		if len(data) != 4 {
			t.Fatalf("Expected exactly 4 blocks to be returned but received %d", len(data))
		}
		if data[0].Height > data[1].Height {
			t.Fatalf("Expected data to be in ascending order of block height: %v", data)
		}
		if data[len(data)-1].Height != extraBlock.Height {
			t.Fatalf("Element at last index is incorrect - expected %v but got %v", extraBlock, data[len(data)-1])
		}
	})

	// Gets the latest two blocks
	t.Run("Get Latest Blocks from both Stores", func(t *testing.T) {
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
		if data[0].Height != extraBlock.Height {
			t.Fatalf("Element at index 0 is incorrect - expected %v but got %v", extraBlock, data[0])
		}
	})

	// Gets the latest block
	t.Run("Get Latest Block from both Stores", func(t *testing.T) {
		data, err := blockStore.GetLatestBlock(ctx, chainID)
		if err != nil {
			t.Fatal(err)
		}
		if data.Height != extraBlock.Height {
			t.Fatalf("Expected %v but got %v", extraBlock, data)
		}
	})
}
