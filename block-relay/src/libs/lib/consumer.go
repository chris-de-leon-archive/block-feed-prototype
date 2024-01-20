package lib

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/cache"
	"block-relay/src/libs/common"
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	rmq "github.com/rabbitmq/amqp091-go"
)

type (
	BlockConsumerOptsEnv struct {
		QueueUrl     string `env:"BLOCK_CONSUMER_QUEUE_URL"`
		QueueName    string `env:"BLOCK_CONSUMER_QUEUE_NAME"`
		ConsumerName string `env:"BLOCK_CONSUMER_NAME"`
		MaxPoolSize  string `env:"BLOCK_CONSUMER_MAX_POOL_SIZE"`
	}

	BlockConsumerOpts struct {
		QueueUrl     string `validate:"required"`
		QueueName    string `validate:"required"` // TODO: validate length is not 0
		ConsumerName string `validate:"required"` // TODO: validate length is not 0
		MaxPoolSize  uint64 `validate:"gt=0"`
	}

	BlockConsumer struct {
		logger     *log.Logger
		httpClient *http.Client
		rmqConn    *rmq.Connection
		cache      *cache.RedisCache[string, []byte]
		opts       *BlockConsumerOpts
	}
)

func RunBlockConsumer(ctx context.Context) error {
	// Parses env variables
	opts, err := common.ParseOpts[BlockConsumerOptsEnv, BlockConsumerOpts](func(env *BlockConsumerOptsEnv) (*BlockConsumerOpts, error) {
		maxPoolSize, err := strconv.ParseUint(env.MaxPoolSize, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("could not parse MaxPoolSize value \"%s\" as uint64: %v", env.MaxPoolSize, err)
		}

		return &BlockConsumerOpts{
			QueueUrl:     env.QueueUrl,
			QueueName:    env.QueueName,
			ConsumerName: env.ConsumerName,
			MaxPoolSize:  maxPoolSize,
		}, nil
	})
	if err != nil {
		return err
	}

	// Defines a logger
	logger := log.New(os.Stdout, "["+opts.ConsumerName+"] ", log.LstdFlags)

	// Logs a starting message
	logger.Printf("Setting up block consumer on queue \"%s\" with %d Go routine(s)\n", opts.QueueName, opts.MaxPoolSize)

	// Initializes a chain resolver
	resolver := blockchains.NewChainResolver()
	defer resolver.Close()

	// Initializes a redis cache
	cache, err := cache.NewRedisCache[string, []byte]()
	if err != nil {
		return nil
	} else {
		logger.Println("Successfully established TCP connection to Redis cache")
		defer cache.Close()
	}

	// Creates a new Rabbit MQ connection
	conn, err := rmq.Dial(opts.QueueUrl)
	if err != nil {
		return err
	} else {
		logger.Println("Successfully established AMQP connection to RabbitMQ")
		defer conn.Close()
	}

	// Ensures that the webhook queue exists
	queue, err := declareDurableQueueWithConn(conn, opts.QueueName)
	if err != nil {
		return err
	} else {
		logger.Printf("Successfully declared queue \"%s\"\n", queue.Name)
	}

	// Defines an HTTP client for webhook requests
	httpClient := http.Client{}

	// Defines a consumer function
	consumeMsg := func(logger *log.Logger, ch *rmq.Channel, msg rmq.Delivery) error {
		// Logs a starting message
		logger.Println("Processing message")

		// Parses the data
		data, err := common.JsonParse[WebhookData](string(msg.Body))
		if err != nil {
			return err
		} else {
			logger.Printf("Successfully parsed webhook data with %d bytes\n", len(msg.Body))
		}

		// Gets the block data
		blockInfo, err := common.JsonParse[BlockData](string(data.Block))
		if err != nil {
			return err
		} else {
			logger.Printf("Successfully parsed block data with %d bytes", len(data.Block))
		}

		// Creates a cache key for the block which is [chain ID]:[block number/height]
		cacheKey := strings.Join([]string{string(blockInfo.Blockchain.ChainID), strconv.FormatUint(blockInfo.Height, 10)}, ":")

		// Tries to get the block from the cache
		block, err := cache.Get(ctx, cacheKey)
		if err != nil {
			return err
		} else {
			logger.Printf("Sent query to cache for key \"%s\"\n", cacheKey)
		}

		// If the block was not found in the cache, get it from the chain and cache it
		if block == nil {
			logger.Printf("Cache does not contain a value for key \"%s\"\n", cacheKey)

			resolvedChain, err := resolver.ResolveChain(blockInfo.Blockchain)
			if err != nil {
				return err
			} else {
				logger.Println("Successfully resolved blockchain client")
			}

			fetchedBlock, err := resolvedChain.GetBlockAtHeight(ctx, blockInfo.Height)
			if err != nil {
				return err
			} else {
				logger.Printf("Successfully fetched block %d from chain \"%s\"\n", blockInfo.Height, blockInfo.Blockchain.ChainID)
			}

			err = cache.Put(ctx, cacheKey, fetchedBlock)
			if err != nil {
				return err
			} else {
				logger.Printf("Successfully added block %d from chain \"%s\" to cache\n", blockInfo.Height, blockInfo.Blockchain.ChainID)
			}

			block = &fetchedBlock
		} else {
			logger.Printf("Cache hit for block %d on chain \"%s\"\n", blockInfo.Height, blockInfo.Blockchain.ChainID)
		}

		// Creates a POST request
		req, err := http.NewRequestWithContext(
			ctx,
			"POST",
			data.Url,
			bytes.NewBuffer(*block),
		)
		if err != nil {
			return err
		} else {
			logger.Printf("Successfully created HTTP request for block %d on chain \"%s\"", blockInfo.Height, blockInfo.Blockchain.ChainID)
		}

		// Sets request headers and sends the request
		req.Header.Set("Content-Type", "application/json")
		_, err = common.RetryIfError[*http.Response](
			data.MaxRetries,
			common.ConstantDelay(logger, data.RetryDelayMs, true),
			func() (*http.Response, error) {
				return httpClient.Do(req)
			},
		)
		if err != nil {
			logger.Printf("Failed to send HTTP request for block %d on chain \"%s\": %v\n", blockInfo.Height, blockInfo.Blockchain.ChainID, err)
		} else {
			logger.Printf("Successfully sent HTTP request for block %d on chain \"%s\"\n", blockInfo.Height, blockInfo.Blockchain.ChainID)
		}

		// Acks the message
		err = ch.Ack(msg.DeliveryTag, false)
		if err != nil {
			return err
		} else {
			logger.Printf("Successfully sent ACK for block %d on chain \"%s\"\n", blockInfo.Height, blockInfo.Blockchain.ChainID)
		}

		// Logs a success message
		return nil
	}

	// Creates a fixed size Go routine pool
	for i := uint64(1); i <= opts.MaxPoolSize; i++ {
		// Creates a new RabbitMQ channel for the routine
		ch, err := conn.Channel()
		if err != nil {
			return err
		}

		// Opens a Go channel to read messages from the queue
		msgs, err := ch.ConsumeWithContext(
			ctx,               // context
			opts.QueueName,    // queue name
			opts.ConsumerName, // consumer name
			false,             // autoAck
			false,             // exclusive
			false,             // noLocal
			false,             // noWait
			nil,               // args
		)
		if err != nil {
			return err
		}

		// Spawns a Go routine
		go func(id uint64) {
			// Close the RMQ channel once this routine exits
			defer ch.Close()

			// Creates a new logger for the go routine
			logger := log.New(os.Stdout, "["+opts.ConsumerName+"-"+strconv.FormatUint(id, 10)+"] ", log.LstdFlags)

			// Logs a starting message
			logger.Printf("Go routine %d online\n", id)

			// Processes messages until the context is cancelled
			for {
				select {
				case msg := <-msgs:
					err = consumeMsg(logger, ch, msg)
					if err != nil {
						logger.Printf("%v\n", err)
					}
				case <-ctx.Done():
					return
				}
			}
		}(i)
	}

	// Waits for the context to be cancelled
	<-ctx.Done()

	// If no errors occurred - return nil
	return nil
}
