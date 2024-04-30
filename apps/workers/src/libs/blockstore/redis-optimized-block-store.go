package blockstore

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/onflow/go-ethereum/common/math"
	"golang.org/x/sync/errgroup"
)

type (
	RedisOptimizedBlockStoreFlushOpts struct {
		IntervalMs int
		MaxBlocks  int
	}

	RedisOptimizedBlockStore struct {
		wrappedStore IBlockStore
		redisStore   *RedisBlockStore
	}
)

// NOTE: redis should be configured with a noeviction policy in order for this blockstore to work
func NewRedisOptimizedBlockStore(wrappedStore IBlockStore, redisStore *RedisBlockStore) *RedisOptimizedBlockStore {
	return &RedisOptimizedBlockStore{
		wrappedStore: wrappedStore,
		redisStore:   redisStore,
	}
}

func (blockStore *RedisOptimizedBlockStore) Init(ctx context.Context, chainID string) error {
	eg := new(errgroup.Group)
	eg.Go(func() error { return blockStore.wrappedStore.Init(ctx, chainID) })
	eg.Go(func() error { return blockStore.redisStore.Init(ctx, chainID) })
	return eg.Wait()
}

func (blockStore *RedisOptimizedBlockStore) StartFlushing(ctx context.Context, chainID string, opts RedisOptimizedBlockStoreFlushOpts) error {
	// Sets the flush interval
	if opts.IntervalMs <= 0 {
		opts.IntervalMs = 3000
	}

	// Sets the block threshold for flushing
	if opts.MaxBlocks <= 0 {
		opts.MaxBlocks = 100
	}

	// Defines a helper function for flushing blocks from the cache to the database
	flushCache := func() error {
		// TODO: listen to keyspace events: https://redis.io/docs/latest/develop/use/keyspace-notifications/
		blocks, err := blockStore.redisStore.GetBlocks(ctx, chainID, 0, math.MaxUint64)
		if err != nil {
			return err
		}
		if len(blocks) >= opts.MaxBlocks {
			if err := blockStore.wrappedStore.PutBlocks(ctx, chainID, blocks); err != nil {
				return err
			}
			if err := blockStore.redisStore.Flush(ctx); err != nil {
				return err
			}
			fmt.Printf("Successfully flushed %d block(s)\n", len(blocks))
		}
		return nil
	}

	// Flushes the cache immediately
	if err := flushCache(); err != nil {
		return err
	}

	// Creates a timer
	timerDuration := time.Duration(opts.IntervalMs) * time.Millisecond
	timer := time.NewTimer(timerDuration)
	defer timer.Stop()

	// Periodically flush blocks from the cache to the database
	for {
		// Suppose instead of a timer we used a 2-second ticker but it takes 3+ seconds
		// to perform processing. If the ticker activates while data is being processed,
		// then we'll immediately process the data again, which is not intended. Instead,
		// we want to fully wait another 2 seconds *from the time we finished processing
		// the last round* before trying to process the data again. With that in mind a
		// timer would be more appropriate here.
		timer.Reset(timerDuration)
		select {
		case <-ctx.Done():
			return nil
		case _, ok := <-timer.C:
			if !ok {
				return nil
			}
			if err := flushCache(); err != nil {
				return err
			}
		}
	}
}

func (blockStore *RedisOptimizedBlockStore) PutBlocks(ctx context.Context, chainID string, blocks []BlockDocument) error {
	// Note that we always write blocks to the redis store first since it is more well suited for high volume writes
	// The data will be flushed to timescale DB in batches perioically by a separate process / goroutine
	return blockStore.redisStore.PutBlocks(ctx, chainID, blocks)
}

func (blockStore *RedisOptimizedBlockStore) GetBlocks(ctx context.Context, chainID string, startHeight uint64, endHeight uint64) ([]BlockDocument, error) {
	// Exits early if the block range is invalid
	if startHeight > endHeight {
		return []BlockDocument{}, nil
	}

	// Computes the total number of blocks to fetch
	numBlocks := endHeight - startHeight + 1
	if numBlocks <= 0 {
		return []BlockDocument{}, nil
	}

	// Queries the cache for the blocks
	dirtyBlocks, err := blockStore.redisStore.GetBlocks(ctx, chainID, startHeight, endHeight)
	if err != nil {
		return nil, err
	}

	// Exits early if the cache had all the blocks
	if uint64(len(dirtyBlocks)) == numBlocks {
		return dirtyBlocks, nil
	}

	// If the cache had no blocks (because it was recently flushed), then get all the blocks from the database
	if len(dirtyBlocks) == 0 {
		return blockStore.wrappedStore.GetBlocks(ctx, chainID, startHeight, endHeight)
	}

	// If the cache only had a portion of the blocks, then we need to get the rest of the blocks from the database
	// The cache will always have blocks that are newer than those in the database - in other words if we queried
	// the range [1, 10], and we got [5, 6, 7] back from the cache, then the database will only have [1, 2, 3, 4]
	endHeight = dirtyBlocks[0].Height - 1

	// Queries the database for the rest of the blocks
	blocks, err := blockStore.wrappedStore.GetBlocks(ctx, chainID, startHeight, endHeight)
	if err != nil {
		return nil, err
	}

	// Combines the cached blocks with the database blocks - orders the results in ascending order of block height
	return append(blocks, dirtyBlocks...), nil
}

func (blockStore *RedisOptimizedBlockStore) GetLatestBlocks(ctx context.Context, chainID string, limit int64) ([]BlockDocument, error) {
	// Returns an empty slice if the limit is invalid
	if limit <= 0 {
		return []BlockDocument{}, nil
	}

	// Gets the latest blocks from the cache
	dirtyBlocks, err := blockStore.redisStore.GetLatestBlocks(ctx, chainID, limit)
	if err != nil {
		return nil, err
	}

	// Exits early if the cache had all the blocks
	if int64(len(dirtyBlocks)) == limit {
		return dirtyBlocks, nil
	}

	// If the cache had no blocks (because it was recently flushed), then get all the blocks from the database
	if len(dirtyBlocks) == 0 {
		return blockStore.wrappedStore.GetLatestBlocks(ctx, chainID, limit)
	}

	// If the cache only had a portion of the blocks, then we need to get the rest of the blocks from the database
	// The cache will always have blocks that are newer than those in the database - in other words if we queried
	// the range [1, 10], and we got [7, 6, 5] back from the cache, then the database will only have [1, 2, 3, 4]
	endHeight := dirtyBlocks[len(dirtyBlocks)-1].Height - 1

	// Queries the database for the rest of the blocks
	blocks, err := blockStore.wrappedStore.GetBlocks(ctx, chainID, max(0, endHeight-uint64(limit-int64(len(dirtyBlocks)))+1), endHeight)
	if err != nil {
		return nil, err
	}

	// Combines the cached blocks with the database blocks - orders the results in descending order of block height
	result := append(dirtyBlocks, blocks...)
	slices.SortFunc(result, func(a, b BlockDocument) int {
		return cmp.Compare(b.Height, a.Height)
	})
	return result, nil
}

func (blockStore *RedisOptimizedBlockStore) GetLatestBlock(ctx context.Context, chainID string) (*BlockDocument, error) {
	// Get the latest block from the cache (if it exists)
	maybeLatestBlock, err := blockStore.redisStore.GetLatestBlock(ctx, chainID)
	if err != nil {
		return nil, err
	}

	// Exits early if the cache had the block
	if maybeLatestBlock != nil {
		return maybeLatestBlock, err
	}

	// If the cache didn't have any data, query the database
	return blockStore.wrappedStore.GetLatestBlock(ctx, chainID)
}
