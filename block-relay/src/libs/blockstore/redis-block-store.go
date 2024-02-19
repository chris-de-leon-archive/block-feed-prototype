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

func NewRedisBlockStore(client *redis.Client) IBlockStore {
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
	// Gets the cached blocks (range is inclusive)
	rawBlocks, err := blockStore.client.ZRangeByScore(ctx, chainID,
		&redis.ZRangeBy{
			Min: strconv.FormatUint(startHeight, 10),
			Max: strconv.FormatUint(endHeight, 10),
		},
	).Result()
	if err != nil {
		return []BlockDocument{}, err
	}

	// Parses the results
	blocks := make([]BlockDocument, len(rawBlocks))
	for i, b := range rawBlocks {
		var block BlockDocument
		if err := json.Unmarshal([]byte(b), &block); err != nil {
			return []BlockDocument{}, err
		} else {
			blocks[i] = block
		}
	}

	// Returns the blocks
	return blocks, nil
}

func (blockStore *RedisBlockStore) GetLatestBlock(ctx context.Context, chainID string) (*BlockDocument, error) {
	// Fetches the last block height that was pushed to redis if one exists
	result, err := blockStore.client.ZRange(ctx, chainID, -1, -1).Result()
	if err != nil {
		return nil, err
	}

	// Returns nil if there is no data
	if len(result) == 0 {
		return nil, nil
	}

	// Parses the block
	var block BlockDocument
	if err := json.Unmarshal([]byte(result[0]), &block); err != nil {
		return nil, err
	}

	// Returns the block
	return &block, nil
}

func (blockStore *RedisBlockStore) GetLatestBlocks(ctx context.Context, chainID string, limit int64) ([]BlockDocument, error) {
	// If this is not here, then we'll return everything from the store when limit is 0
	if limit == 0 {
		return []BlockDocument{}, nil
	}

	// Fetches the last block height that was pushed to redis if one exists
	rawBlocks, err := blockStore.client.ZRevRange(ctx, chainID, 0, limit-1).Result()
	if err != nil {
		return []BlockDocument{}, err
	}

	// Parses the results
	blocks := make([]BlockDocument, len(rawBlocks))
	for i, b := range rawBlocks {
		var block BlockDocument
		if err := json.Unmarshal([]byte(b), &block); err != nil {
			return []BlockDocument{}, err
		} else {
			blocks[i] = block
		}
	}

	// Returns the block
	return blocks, nil
}
