package relayer

import (
	"block-relay/src/libs/common"
	"block-relay/src/libs/threading"
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

//
// IMPORTANT: in go-redis v9, contexts don't seem to be working for some
// commands (e.g. BLMOVE):
//
// 	https://github.com/redis/go-redis/pull/2232#discussion_r996501303
//
// This is problematic because if a context is cancelled, then the redis client
// will not respect the cancellation signal and the program may hang infinitely.
// To get around this, we instead use the "Do" function on the redis client since
// it actually seems to be context aware. This will allow us to implement graceful
// shut downs correctly.
//

const (
	BLOCK_HEIGHT_KEY_NAME = "relayer:height"
	IN_PROGRESS_QNAME     = "relayer:inprog"
	TODO_QNAME            = "relayer:todo"
)

type (
	IBlockchain interface {
		GetBlockAtHeight(ctx context.Context, height uint64) ([]byte, error)
		GetLatestBlockHeight(ctx context.Context) (uint64, error)
		ID() string
	}

	RelayerRedisKeys struct {
		BlockHeight string
		InProgQueue string
		TodoQueue   string
	}

	RelayerQueueData struct {
		Timestamp int64
		Chain     string
		Height    uint64
		Block     []byte
	}

	RawRelayerOpts struct {
		RedisConnectionURL string `env:"RELAYER_REDIS_CONNECTION_URL"`
		PollMs             string `env:"RELAYER_POLL_MS"`
	}

	RelayerOpts struct {
		RedisConnectionURL string `validate:"required"`
		PollMs             int    `validate:"required,gt=0"`
	}

	Relayer struct {
		threadManager *threading.ThreadManager
		keys          *RelayerRedisKeys
		opts          *RelayerOpts
		chain         IBlockchain
	}
)

func New(chain IBlockchain) *Relayer {
	threadManager := threading.Manager()

	opts := common.ParseOpts[RawRelayerOpts, RelayerOpts](func(env *RawRelayerOpts) *RelayerOpts {
		return &RelayerOpts{
			RedisConnectionURL: env.RedisConnectionURL,
			PollMs:             common.PanicIfError(strconv.Atoi(env.PollMs)),
		}
	})

	return &Relayer{
		threadManager: threadManager,
		chain:         chain,
		opts:          opts,
		keys: &RelayerRedisKeys{
			BlockHeight: BLOCK_HEIGHT_KEY_NAME + ":" + chain.ID(),
			InProgQueue: IN_PROGRESS_QNAME + ":" + chain.ID(),
			TodoQueue:   TODO_QNAME + ":" + chain.ID(),
		},
	}
}

func (this *Relayer) Run(ctx context.Context, consumer func(ctx context.Context, data RelayerQueueData) error) {
	this.threadManager.Spawn(func() {
		this.runConsumerUntilCancelled(ctx, consumer)
	})

	this.threadManager.Spawn(func() {
		this.runBlockPollerUntilCancelled(ctx)
	})

	this.threadManager.Wait()
}

func (this *Relayer) runBlockPollerUntilCancelled(ctx context.Context) {
	// Connects to redis
	conn := redis.NewClient(&redis.Options{
		Addr: this.opts.RedisConnectionURL,
	})

	// Make sure the connection is closed once this function exits
	defer conn.Close()

	// Continuously produce jobs
	common.LoopUntilCancelled(ctx, func() {
		// Fetch the latest block
		latestBlockHeight, err := this.chain.GetLatestBlockHeight(ctx)
		if err != nil {
			fmt.Printf("error: %v\n", err)
			return
		}

		// Resolve the current block height
		height, err := conn.Do(ctx, "GET", this.keys.BlockHeight).Uint64()
		switch {
		case errors.Is(err, redis.Nil):
			height = latestBlockHeight
			break
		case err != nil:
			fmt.Printf("error: %v\n", err)
			return
		}

		// Validate the current block height
		if height > latestBlockHeight {
			fmt.Printf("error: %v\n", fmt.Errorf("current height (%d) is larger than latest block height (%d)", height, latestBlockHeight))
			time.Sleep(time.Duration(this.opts.PollMs) * time.Millisecond)
			return
		}

		// Fetch the block
		block, err := this.chain.GetBlockAtHeight(ctx, height)
		if err != nil {
			fmt.Printf("error: %v\n", err)
			return
		}

		// Create queue data
		data, err := common.JsonStringify(RelayerQueueData{
			Timestamp: time.Now().Unix(),
			Chain:     this.chain.ID(),
			Height:    height,
			Block:     block,
		})
		if err != nil {
			fmt.Printf("error: %v\n", err)
			return
		}

		// Start a tx, increment the block height, add the block to a queue, and commit
		err = conn.Watch(ctx, func(tx *redis.Tx) error {
			_, err := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
				err = pipe.Do(ctx, "SET", this.keys.BlockHeight, height, "NX").Err()
				if err != nil && !errors.Is(err, redis.Nil) {
					return err
				}
				err = pipe.Do(ctx, "INCR", this.keys.BlockHeight).Err()
				if err != nil && !errors.Is(err, redis.Nil) {
					return err
				}
				err = pipe.Do(ctx, "RPUSH", this.keys.TodoQueue, data).Err()
				if err != nil && !errors.Is(err, redis.Nil) {
					return err
				}
				return nil
			})
			return err
		}, this.keys.BlockHeight, this.keys.TodoQueue)

		// Handle any transaction errors
		switch {
		case errors.Is(err, redis.TxFailedErr):
			fmt.Printf("error: %v\n", err)
			break
		case errors.Is(err, redis.Nil):
			break
		case err != nil:
			fmt.Printf("error: %v\n", err)
			break
		}

		// Wait before re-looping
		time.Sleep(time.Duration(this.opts.PollMs) * time.Millisecond)
	})
}

func (this *Relayer) runConsumerUntilCancelled(ctx context.Context, consumer func(ctx context.Context, data RelayerQueueData) error) {
	// Connects to redis
	conn := redis.NewClient(&redis.Options{
		Addr: this.opts.RedisConnectionURL,
	})

	// Make sure the connection is closed once this function exits
	defer conn.Close()

	// Continuously consume jobs
	common.LoopUntilCancelled(ctx, func() {
		// Picks up any in progress jobs
		// 	-> If all in progress jobs have been processed, process jobs from the TODO queue
		// 	-> If no data is in the TODO queue, wait for data to be added before continuing
		val, err := conn.Do(ctx, "LMOVE", this.keys.InProgQueue, this.keys.InProgQueue, "LEFT", "LEFT").Text()
		switch {
		case errors.Is(err, redis.Nil):
			val, err = conn.Do(ctx, "BLMOVE", this.keys.TodoQueue, this.keys.InProgQueue, "LEFT", "RIGHT", 0).Text()
			if err != nil {
				fmt.Printf("error: %v\n", err)
				return
			}
			break
		case err != nil:
			fmt.Printf("error: %v\n", err)
			return
		}

		// Parses the queue data
		item, err := common.JsonParse[RelayerQueueData](val)
		if err != nil {
			fmt.Printf("error: %v\n", err)
			return
		}

		// If there was an error running the consumer, retry the job
		err = consumer(ctx, item)
		if err != nil {
			fmt.Printf("error: %v\n", err)
			return
		}

		// NOTE: if the program is terminated AFTER the consumer is run but
		// BEFORE the job is removed from the queue (i.e. right here in the
		// code), then the client will receive the same block multiple times.

		// If the consumer runs successfully, remove the job
		conn.Do(ctx, "LREM", this.keys.InProgQueue, 0, val)
	})
}
