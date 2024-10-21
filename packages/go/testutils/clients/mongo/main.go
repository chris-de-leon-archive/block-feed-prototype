package mongo

import (
	"context"
	"testing"

	// https://www.mongodb.com/docs/drivers/go/current/fundamentals/connections/network-compression/#compression-algorithm-dependencies
	_ "compress/zlib"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetMongoClient(t *testing.T, ctx context.Context, url string) (*mongo.Client, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(url))
	if err != nil {
		return nil, err
	}

	t.Cleanup(func() {
		if err := client.Disconnect(context.Background()); err != nil {
			t.Log(err)
		}
	})

	return client, nil
}
