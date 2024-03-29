package blockstore

import (
	"context"
	"encoding/json"
)

type (
	// For MongoDB:
	//
	//  Each blockchain has its own collection which stores its blocks. Each block
	//  has a unique block height, so a collection can be indexed on this field.
	//  A list of BSON types can be found here:
	//
	//   https://www.mongodb.com/docs/manual/reference/bson-types/
	//
	//  It is important to note that MongoDB v7 time series collections do not support
	//  UPSERTS:
	//
	//   https://www.mongodb.com/docs/manual/core/timeseries/timeseries-limitations/#updates
	//
	//  They also do not support transactional batch writes:
	//
	//   https://www.mongodb.com/docs/manual/core/timeseries/timeseries-limitations/#transactions
	//
	//  Due to these limitations, a time series collection is not ideal for the block
	//  store implementation. Upserts are used to ignore duplicate rows, and the ACID
	//  properties of transactions are critical for ensuring that the data is stored
	//  properly.
	//
	// For Postgres + timescaledb extension:
	//
	//  Each blockchain has its own hypertable which stores its blocks. Each block
	//  has a unique height which is also related to time, so a hypertable can be
	//  indexed AND partitioned on this field. We use `db` struct tags for pgx row
	//  scanning:
	//
	//    https://pkg.go.dev/github.com/jackc/pgx/v5#RowToStructByName
	//
	// For redis:
	//
	//  Each blockchain has its own sorted set which stores its blocks. Each block
	//  has a unique height so it can be used as the keys of the sorted set.
	//
	BlockDocument struct {
		Data   []byte `json:"Data" bson:"Data" bsonType:"binData" db:"block"`
		Height uint64 `json:"Height" bson:"Height" bsonType:"long" isIndex:"true" db:"block_height"`
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
