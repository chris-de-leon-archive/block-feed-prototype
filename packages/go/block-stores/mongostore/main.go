package mongostore

import (
	"context"
	"errors"
	"reflect"
	"strings"

	"github.com/chris-de-leon/block-feed-prototype/block-stores/blockstore"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

type (
	MongoBlockStore struct {
		client *mongo.Client
		db     *mongo.Database
	}
)

var (
	schema bson.M
	index  string
)

func init() {
	// Uses reflect to get the BlockDocument struct metadata
	var empty blockstore.BlockDocument
	st := reflect.TypeOf(empty)

	// Defines the collection column properties
	properties := bson.M{"_id": bson.M{"bsonType": "objectId"}}
	fieldNames := make([]string, st.NumField())
	for i := 0; i < st.NumField(); i++ {
		field := st.Field(i)
		fName := field.Tag.Get("bson")
		fType := field.Tag.Get("bsonType")
		properties[fName] = bson.M{"bsonType": fType}
		fieldNames[i] = fName
	}

	// Defines the JSON schema validator for the collection
	schema = bson.M{
		"$jsonSchema": bson.M{
			"bsonType":             "object",
			"required":             fieldNames,
			"properties":           properties,
			"additionalProperties": false,
		},
	}

	// Gets the name of the index column
	for i := 0; i < st.NumField(); i++ {
		field := st.Field(i)
		if field.Tag.Get("isIndex") == "true" {
			index = field.Name
			return
		}
	}

	// Panics if the struct does not define an index field/column
	panic(errors.New("index column was not set"))
}

func NewMongoBlockStore(client *mongo.Client, databaseName string) *MongoBlockStore {
	return &MongoBlockStore{
		client: client,
		db:     client.Database(databaseName),
	}
}

func (mongoBlockStore *MongoBlockStore) Init(ctx context.Context, chainID string) error {
	// Defines collection options
	collectionOpts := options.CreateCollection().SetValidationLevel("strict").SetValidator(schema)

	// Defines collection index parameters
	// https://www.mongodb.com/docs/drivers/go/current/fundamentals/indexes/#unique-indexes
	indexModel := mongo.IndexModel{
		Keys:    bson.M{index: 1},
		Options: options.Index().SetUnique(true),
	}

	// Defines transaction opts
	txOpts := options.Transaction().
		SetWriteConcern(writeconcern.W1()).
		SetReadConcern(readconcern.Local()).
		SetReadPreference(readpref.Primary())

	// Creates a collection and an index on the collection using a transaction
	// If the collection and index already exist, then this will do nothing
	return mongoBlockStore.db.Client().UseSession(ctx, func(sess mongo.SessionContext) error {
		_, err := sess.WithTransaction(
			ctx,
			func(tx mongo.SessionContext) (interface{}, error) {
				if err := mongoBlockStore.db.CreateCollection(tx, chainID, collectionOpts); err != nil {
					isCollectionNamespaceError := strings.Contains(err.Error(), "(NamespaceExists) Collection")
					isAlreadyExistsError := strings.Contains(err.Error(), "already exists")
					if isCollectionNamespaceError && isAlreadyExistsError {
						return nil, tx.AbortTransaction(tx)
					} else {
						return nil, err
					}
				}
				return mongoBlockStore.db.Collection(chainID).Indexes().CreateOne(tx, indexModel)
			},
			txOpts,
		)
		return err
	})
}

func (mongoBlockStore *MongoBlockStore) PutBlocks(ctx context.Context, chainID string, blocks []blockstore.BlockDocument) error {
	// Creates an arrary of idempotent write operations to be performed in bulk
	writes := make([]mongo.WriteModel, len(blocks))
	for i, block := range blocks {
		writes[i] = mongo.NewUpdateOneModel().
			SetUpsert(true).
			SetFilter(bson.M{index: block.Height}).
			SetUpdate(bson.M{"$set": block})
	}

	// Performs an unordered (a.k.a parallel) bulk write
	bulkWriteOpts := options.BulkWrite().SetOrdered(false)

	// Defines transaction opts (optimized for low latency)
	txOpts := options.Transaction().
		SetWriteConcern(writeconcern.W1()).
		SetReadConcern(readconcern.Local()).
		SetReadPreference(readpref.Nearest())

	// Performs an atomic bulk write to store the blocks
	return mongoBlockStore.db.Client().UseSession(ctx, func(sess mongo.SessionContext) error {
		_, err := sess.WithTransaction(
			ctx,
			func(tx mongo.SessionContext) (interface{}, error) {
				return mongoBlockStore.db.Collection(chainID).BulkWrite(tx, writes, bulkWriteOpts)
			},
			txOpts,
		)
		return err
	})
}

func (mongoBlockStore *MongoBlockStore) GetBlocks(ctx context.Context, chainID string, startHeight uint64, endHeight uint64) ([]blockstore.BlockDocument, error) {
	// Returns an empty slice if the range is invalid
	if startHeight > endHeight {
		return []blockstore.BlockDocument{}, nil
	}

	// Gets blocks in the inclusive range [startHeight, endHeight]
	findFilter := bson.D{primitive.E{
		Key: "$and",
		Value: bson.A{
			bson.D{primitive.E{
				Key: index,
				Value: bson.D{primitive.E{
					Key:   "$gte",
					Value: startHeight,
				}},
			}},
			bson.D{primitive.E{
				Key: index,
				Value: bson.D{primitive.E{
					Key:   "$lte",
					Value: endHeight,
				}},
			}},
		},
	}}

	// Ensures that the blocks are returned in ascending order of block height (e.g. 1, 2, 3)
	findOpts := options.Find().SetSort(bson.D{primitive.E{Key: index, Value: 1}})

	// Gets a cursor over the results
	cursor, err := mongoBlockStore.db.Collection(chainID).Find(ctx, findFilter, findOpts)
	if err != nil {
		return []blockstore.BlockDocument{}, err
	} else {
		defer cursor.Close(ctx)
	}

	// Collects all elements of the cursor into a slice
	var blocks []blockstore.BlockDocument
	if err = cursor.All(ctx, &blocks); err != nil {
		return []blockstore.BlockDocument{}, err
	}

	// Returns the blocks
	return blocks, nil
}

func (mongoBlockStore *MongoBlockStore) GetLatestBlock(ctx context.Context, chainID string) (*blockstore.BlockDocument, error) {
	// Sorts blocks in descending order
	findOpts := options.FindOne().
		SetSort(bson.D{primitive.E{Key: index, Value: -1}})

	// Gets the first block
	var block blockstore.BlockDocument
	err := mongoBlockStore.db.Collection(chainID).FindOne(ctx, bson.D{}, findOpts).Decode(&block)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Returns the block
	return &block, nil
}

func (mongoBlockStore *MongoBlockStore) GetLatestBlocks(ctx context.Context, chainID string, limit int64) ([]blockstore.BlockDocument, error) {
	// Returns an empty slice if limit is invalid
	if limit <= 0 {
		return []blockstore.BlockDocument{}, nil
	}

	// Ensures that the blocks are returned in descending order of block height (e.g. 3, 2, 1)
	findOpts := options.Find().
		SetSort(bson.D{primitive.E{Key: index, Value: -1}}).
		SetLimit(limit)

	// Gets a cursor over the results
	cursor, err := mongoBlockStore.db.Collection(chainID).Find(ctx, bson.D{}, findOpts)
	if err != nil {
		return []blockstore.BlockDocument{}, err
	} else {
		defer cursor.Close(ctx)
	}

	// Collects all elements of the cursor into a slice
	var blocks []blockstore.BlockDocument
	if err = cursor.All(ctx, &blocks); err != nil {
		return []blockstore.BlockDocument{}, err
	}

	// Returns the blocks
	return blocks, nil
}
