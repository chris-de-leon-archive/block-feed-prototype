package main

import (
	"appenv"
	"blockrelay"
	"cachedstore"
	"common"
	"context"
	"database/sql"
	"log"
	"os/signal"
	"queries"
	"redistore"
	"streams"
	"syscall"
	"time"
	"timescalestore"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type EnvVars struct {
	ConsumerName string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_NAME,required"`
	MySqlUrl     string `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_MYSQL_URL,required"`
	appenv.ChainEnv
	MySqlConnPoolSize int   `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_MYSQL_CONN_POOL_SIZE,required"`
	ConsumerPoolSize  int   `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_POOL_SIZE,required"`
	ShardID           int32 `validate:"required,gt=0" env:"WEBHOOK_CONSUMER_SHARD_ID,required"`
}

// NOTE: multiple replicas of this service can be created per chain
// NOTE: a chain with S shards should have at least 1 webhook consumer replica per shard
func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Loads env variables into a struct and validates them
	envvars, err := appenv.LoadEnvVars[EnvVars]()
	if err != nil {
		panic(err)
	}

	// Creates a mysql client
	mysqlClient, err := sql.Open("mysql", envvars.MySqlUrl)
	if err != nil {
		panic(err)
	} else {
		defer func() {
			if err := mysqlClient.Close(); err != nil {
				common.LogError(nil, err)
			}
		}()
		mysqlClient.SetConnMaxLifetime(time.Duration(30) * time.Second)
		mysqlClient.SetMaxOpenConns(envvars.MySqlConnPoolSize)
		mysqlClient.SetMaxIdleConns(envvars.MySqlConnPoolSize)
	}

	// Shard IDs are 0-indexed internally (externally they start from index 1)
	shardID := envvars.ShardID - 1

	// Validates the shard ID
	if shardID >= envvars.ShardCount {
		log.Fatalf("Shard ID (%d) must be less than the total number of shards (%d)", shardID, envvars.ShardCount)
	}

	// Creates a redis cluster client
	redisClusterClient := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs:                 []string{envvars.RedisClusterUrl},
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisClusterClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates a redis store client
	redisStoreClient := redis.NewClient(&redis.Options{
		Addr:                  envvars.RedisStoreUrl,
		ContextTimeoutEnabled: true,
	})
	defer func() {
		if err := redisStoreClient.Close(); err != nil {
			common.LogError(nil, err)
		}
	}()

	// Creates a database connection pool
	pgClient, err := pgxpool.New(ctx, envvars.PgStoreUrl)
	if err != nil {
		panic(err)
	}
	defer pgClient.Close()

	// Creates a block store
	store := cachedstore.NewRedisOptimizedBlockStore(
		timescalestore.NewTimescaleBlockStore(pgClient),
		redistore.NewRedisBlockStore(redisStoreClient),
	)

	// Initializes the store
	if err := store.Init(ctx, envvars.ChainID); err != nil {
		panic(err)
	}

	// Creates the service
	service := blockrelay.NewBlockRelay(blockrelay.BlockRelayParams{
		WebhookStream: streams.NewWebhookStream(redisClusterClient, shardID),
		Queries:       queries.New(mysqlClient),
		BlockStore:    store,
		Opts: &blockrelay.BlockRelayOpts{
			ConsumerName: envvars.ConsumerName,
			Concurrency:  envvars.ConsumerPoolSize,
		},
	})

	// Runs the consumer until the context is cancelled
	if err = service.Run(ctx); err != nil {
		common.LogError(nil, err)
		panic(err)
	}
}
