package appenv

import (
	"fmt"
	"validation"

	"github.com/caarlos0/env/v11"
)

type (
	ChainEnv struct {
		ChainID         string `validate:"required,gt=0" env:"CHAIN_ID,required"`
		ChainUrl        string `validate:"required,gt=0" env:"CHAIN_URL,required"`
		PgStoreUrl      string `validate:"required,gt=0" env:"CHAIN_PG_STORE_URL,required"`
		RedisStoreUrl   string `validate:"required,gt=0" env:"CHAIN_REDIS_STORE_URL,required"`
		RedisClusterUrl string `validate:"required,gt=0" env:"CHAIN_REDIS_CLUSTER_URL,required"`
		RedisStreamUrl  string `validate:"required,gt=0" env:"CHAIN_REDIS_STREAM_URL,required"`
		ShardCount      int32  `validate:"required,gt=0" env:"CHAIN_SHARD_COUNT,required"`
	}
)

func LoadEnvVars[T any]() (*T, error) {
	var envvars T

	opts := env.Options{
		OnSet: func(tag string, value any, isDefault bool) {
			fmt.Printf("Set %s to %v (default? %v)\n", tag, value, isDefault)
		},
	}

	if err := env.ParseWithOptions(&envvars, opts); err != nil {
		return nil, err
	}

	if err := validation.ValidateStruct(envvars); err != nil {
		return nil, err
	}

	return &envvars, nil
}
