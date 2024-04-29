package testutils

import (
	"block-feed/src/libs/common"
	"context"
	"database/sql"
	"testing"
	"time"

	// https://www.mongodb.com/docs/drivers/go/current/fundamentals/connections/network-compression/#compression-algorithm-dependencies
	_ "compress/zlib"

	"github.com/ethereum/go-ethereum/ethclient"
	_ "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onflow/flow-go-sdk/access/grpc"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetFlowClient(t *testing.T, url string) (*grpc.Client, error) {
	client, err := grpc.NewClient(url)
	if err != nil {
		return nil, err
	}

	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Log(err)
		}
	})

	return client, err
}

func GetEthClient(t *testing.T, url string) (*ethclient.Client, error) {
	client, err := ethclient.Dial(url)
	if err != nil {
		return nil, err
	}

	t.Cleanup(func() {
		client.Close()
	})

	return client, err
}

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

func GetPostgresClient(t *testing.T, ctx context.Context, url string) (*pgxpool.Pool, error) {
	client, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}

	t.Cleanup(func() {
		client.Close()
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

func GetRedisClusterClient(t *testing.T, url string) (*redis.ClusterClient, error) {
	client := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs:                 []string{url},
		ContextTimeoutEnabled: true,
	})

	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Log(err)
		}
	})

	return client, nil
}

func GetTempRedisClusterClient[T any](url string, cb func(client *redis.ClusterClient) (T, error)) (T, error) {
	client := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs:                 []string{url},
		ContextTimeoutEnabled: true,
	})

	defer func() {
		if err := client.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	return cb(client)
}
