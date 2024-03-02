package testutils

import (
	"block-feed/src/libs/common"
	"context"
	"database/sql"
	"testing"
	"time"

	// https://www.mongodb.com/docs/drivers/go/current/fundamentals/connections/network-compression/#compression-algorithm-dependencies
	_ "compress/zlib"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
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

func GetMySqlClient(t *testing.T, url string, dbConnPoolSize int) (*sql.DB, error) {
	db, err := sql.Open("mysql", url)
	if err != nil {
		return nil, err
	} else {
		db.SetConnMaxLifetime(time.Duration(30) * time.Second)
		db.SetMaxOpenConns(dbConnPoolSize)
		db.SetMaxIdleConns(dbConnPoolSize)
	}

	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Log(err)
		}
	})

	return db, nil
}

func GetTempMySqlClient[T any](url string, dbConnPoolSize int, cb func(client *sql.DB) (T, error)) (T, error) {
	var empty T

	client, err := sql.Open("mysql", url)
	if err != nil {
		return empty, err
	} else {
		client.SetConnMaxLifetime(time.Duration(30) * time.Second)
		client.SetMaxOpenConns(dbConnPoolSize)
		client.SetMaxIdleConns(dbConnPoolSize)
	}

	defer func() {
		if err := client.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	return cb(client)
}

func GetRedisClient(t *testing.T, url string) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:                  url,
		ContextTimeoutEnabled: true,
	})

	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Log(err)
		}
	})

	return client, nil
}

func GetTempRedisClient[T any](url string, cb func(client *redis.Client) (T, error)) (T, error) {
	client := redis.NewClient(&redis.Options{
		Addr:                  url,
		ContextTimeoutEnabled: true,
	})

	defer func() {
		if err := client.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	return cb(client)
}
