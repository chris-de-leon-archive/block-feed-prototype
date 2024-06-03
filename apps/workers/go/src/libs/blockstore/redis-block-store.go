package blockstore

import (
	"context"
	"encoding/json"
	"strconv"

	"github.com/redis/go-redis/v9"
)

type (
	RedisBlockStore struct {
		client *redis.Client
	}
)

func NewRedisBlockStore(client *redis.Client) *RedisBlockStore {
	return &RedisBlockStore{
		client: client,
	}
}

func (blockStore *RedisBlockStore) Init(ctx context.Context, chainID string) error {
	return nil
}

func (blockStore *RedisBlockStore) PutBlocks(ctx context.Context, chainID string, blocks []BlockDocument) error {
	// Prepares the blocks for ZADD
	blocksToStore := make([]redis.Z, len(blocks))
	for i, b := range blocks {
		blocksToStore[i] = redis.Z{
			Score:  float64(b.Height),
			Member: b,
		}
	}

	// Stores the blocks that don't already exist
	return blockStore.client.ZAddNX(ctx, chainID, blocksToStore...).Err()
}

func (blockStore *RedisBlockStore) GetBlocks(ctx context.Context, chainID string, startHeight uint64, endHeight uint64) ([]BlockDocument, error) {
	// Returns an empty slice if the range is invalid
	if startHeight > endHeight {
		return []BlockDocument{}, nil
	}

	// Gets the cached blocks (range is inclusive)
	// NOTE: go-redis still uses the deprecated ZRANGEBYSCORE command (https://github.com/redis/go-redis/issues/1709),
	// which has been replaced by ZRANGE with the BYSCORE argument. To avoid calling the deprecated command, we'll use
	// a custom command to call the updated ZRANGE command.
	rawBlocks, err := blockStore.client.Do(ctx,
		"ZRANGE",
		chainID,
		strconv.FormatUint(startHeight, 10),
		strconv.FormatUint(endHeight, 10),
		"BYSCORE",
	).StringSlice()
	if err != nil {
		return []BlockDocument{}, err
	}

	// Returns the blocks in ascending order of block height
	return blockStore.parseBlocks(rawBlocks, true)
}

func (blockStore *RedisBlockStore) GetLatestBlock(ctx context.Context, chainID string) (*BlockDocument, error) {
	blocks, err := blockStore.GetLatestBlocks(ctx, chainID, 1)
	if err != nil {
		return nil, err
	}
	if len(blocks) == 0 {
		return nil, nil
	}
	return &blocks[0], nil
}

func (blockStore *RedisBlockStore) GetLatestBlocks(ctx context.Context, chainID string, limit int64) ([]BlockDocument, error) {
	// If this is not here, then we'll return everything from the store when limit is 0
	if limit <= 0 {
		return []BlockDocument{}, nil
	}

	// Gets the blocks with the largest heights - at most `limit` items will be returned
	rawBlocks, err := blockStore.client.ZRange(ctx, chainID, -limit, -1).Result()
	if err != nil {
		return []BlockDocument{}, err
	}

	// Returns the blocks in descending order of block height
	return blockStore.parseBlocks(rawBlocks, false)
}

func (blockStore *RedisBlockStore) GetEarliestBlocks(ctx context.Context, chainID string, limit int64) ([]BlockDocument, error) {
	// If this is not here, then we'll return everything from the store when limit is 0
	if limit <= 0 {
		return []BlockDocument{}, nil
	}

	// Gets the blocks with the largest heights - at most `limit` items will be returned
	rawBlocks, err := blockStore.client.ZRange(ctx, chainID, 0, limit-1).Result()
	if err != nil {
		return []BlockDocument{}, err
	}

	// Returns the blocks in ascending order of block height
	return blockStore.parseBlocks(rawBlocks, true)
}

func (blockStore *RedisBlockStore) DeleteBlocks(ctx context.Context, chainID string, blocks []BlockDocument) error {
	if len(blocks) == 0 {
		return nil
	}

	members := make([]any, len(blocks))
	for i, b := range blocks {
		members[i] = b
	}

	return blockStore.client.ZRem(ctx, chainID, members...).Err()
}

func (blockStore *RedisBlockStore) parseBlocks(rawBlocks []string, asc bool) ([]BlockDocument, error) {
	blocks := make([]BlockDocument, len(rawBlocks))
	for i, b := range rawBlocks {
		var block BlockDocument
		if err := json.Unmarshal([]byte(b), &block); err != nil {
			return []BlockDocument{}, err
		} else {
			if asc {
				blocks[i] = block
			} else {
				blocks[(len(blocks)-1)-i] = block
			}
		}
	}
	return blocks, nil
}
