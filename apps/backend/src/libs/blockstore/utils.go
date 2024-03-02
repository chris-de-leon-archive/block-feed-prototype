package blockstore

import (
	"context"
	"encoding/json"
)

type (
	// Each blockchain has its own collection which stores its blocks. Each block
	// has a unique block height, so a collection can be indexed on this field.
	// A list of BSON types can be found here:
	//
	//   https://www.mongodb.com/docs/manual/reference/bson-types/
	//
	BlockDocument struct {
		Data   []byte `json:"Data" bson:"Data" bsonType:"binData"`
		Height uint64 `json:"Height" bson:"Height" bsonType:"long" isIndex:"true"`
	}

	// IBlockStore defines a set of operations for querying and storing blocks
	// from an external storage medium such as mongodb, redis, etc.
	IBlockStore interface {
		Init(ctx context.Context, chainID string) error
		PutBlocks(ctx context.Context, chainID string, blocks []BlockDocument) error
		GetBlocks(ctx context.Context, chainID string, startHeight uint64, endHeight uint64) ([]BlockDocument, error)
		GetLatestBlock(ctx context.Context, chainID string) (*BlockDocument, error)
		GetLatestBlocks(ctx context.Context, chainID string, limit int64) ([]BlockDocument, error)
	}
)

func (blockDocument BlockDocument) MarshalBinary() ([]byte, error) {
	// https://github.com/redis/go-redis/issues/739#issuecomment-470634159
	return json.Marshal(blockDocument)
}
