package lib

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/cache"
	"block-relay/src/libs/common"
	"block-relay/src/libs/sqlc"
	"bytes"
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type (
	JobConsumerOpts struct {
		ConsumerName   string
		BlockTimeoutMs int
	}

	JobConsumerParams struct {
		RedisClient   *redis.Client
		RedisCache    *cache.RedisCache[string, CachedBlock]
		ChainResolver *blockchains.ChainResolver
		Opts          JobConsumerOpts
	}

	JobConsumer struct {
		logger        *log.Logger
		chainResolver *blockchains.ChainResolver
		redisCache    *cache.RedisCache[string, CachedBlock]
		redisClient   *redis.Client
		opts          *JobConsumerOpts
	}

	CachedBlock struct {
		Data []byte `json:"data"`
	}
)

func NewJobConsumer(params JobConsumerParams) *JobConsumer {
	return &JobConsumer{
		logger:        log.New(os.Stdout, fmt.Sprintf("[%s-stream-reader] ", params.Opts.ConsumerName), log.LstdFlags),
		chainResolver: params.ChainResolver,
		redisCache:    params.RedisCache,
		redisClient:   params.RedisClient,
		opts:          &params.Opts,
	}
}

func (service *JobConsumer) Run(ctx context.Context) error {
	// Creates a new channel which will hold data from the redis stream
	jobChan := make(chan StreamEntry)
	defer close(jobChan)

	// Creates a fixed size Go routine pool that processes items from the job channel

	go func() {
		logger := log.New(os.Stdout, fmt.Sprintf("[%s-http-worker] ", service.opts.ConsumerName), log.LstdFlags)
		for {
			select {
			case job, ok := <-jobChan:
				if !ok {
					return
				}
				if err := service.consumeJob(ctx, logger, job); err != nil {
					common.LogError(logger, err)
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	// Logs starting message
	service.logger.Println("Ready to consume jobs")

	// Creates a consumer group if one doesn't already exist
	err := service.redisClient.Do(ctx, "XGROUP", "CREATE", REDIS_WEBHOOK_JOB_STREAM_NAME, REDIS_WEBHOOK_JOB_CONSUMER_GROUP_NAME, "$", "MKSTREAM").Err()
	if err != nil {
		if errors.Is(err, redis.Nil) || strings.Contains(err.Error(), "BUSYGROUP") {
			service.logger.Printf("Consumer group \"%s\" already exists for stream \"%s\"\n", REDIS_WEBHOOK_JOB_CONSUMER_GROUP_NAME, REDIS_WEBHOOK_JOB_STREAM_NAME)
		} else {
			return err
		}
	} else {
		service.logger.Printf("Consumer group \"%s\" has been created for stream \"%s\"\n", REDIS_WEBHOOK_JOB_CONSUMER_GROUP_NAME, REDIS_WEBHOOK_JOB_STREAM_NAME)
	}

	// Processes the backlog before moving onto new messages
	cursorId := "0-0"
	for {
		entries, err := readStreamEntries(ctx, service.redisClient,
			REDIS_WEBHOOK_JOB_CONSUMER_GROUP_NAME,
			service.opts.ConsumerName,
			REDIS_WEBHOOK_JOB_STREAM_NAME,
			cursorId,
			1,
			service.opts.BlockTimeoutMs,
		)
		if err != nil {
			return err
		} else {
			service.logger.Printf("Read %d backlog item(s) from stream", len(entries))
		}
		if len(entries) == 0 {
			break
		}
		for _, entry := range entries {
			jobChan <- entry
			cursorId = entry.ID
		}
	}

	// Processes new messages until the context is cancelled
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			entries, err := readStreamEntries(ctx, service.redisClient,
				REDIS_WEBHOOK_JOB_CONSUMER_GROUP_NAME,
				service.opts.ConsumerName,
				REDIS_WEBHOOK_JOB_STREAM_NAME,
				">",
				1,
				service.opts.BlockTimeoutMs,
			)
			if err != nil {
				return err
			} else {
				service.logger.Printf("Read %d new item(s) from stream", len(entries))
			}
			for _, entry := range entries {
				jobChan <- entry
			}
		}
	}
}

func (service *JobConsumer) consumeJob(ctx context.Context, logger *log.Logger, entry StreamEntry) error {
	// Gets the webhook job data from the stream entry using the stream key
	data, exists := entry.Data[REDIS_WEBHOOK_JOB_STREAM_KEY]
	if !exists {
		logger.Printf("Key \"%s\" does not exist in stream entry: %v\n", REDIS_WEBHOOK_JOB_STREAM_KEY, entry)
		return nil
	} else {
		logger.Printf("Received stream entry with ID \"%s\"\n", entry.ID)
	}

	// Parses the webhook job data
	job, err := common.JsonParse[sqlc.WebhookJob](data)
	if err != nil {
		return err
	} else {
		logger.Printf("Processing job with ID \"%d\"\n", job.ID)
	}

	// Creates a cache key for the block which is [chain ID]:[block height]
	cacheKey := strings.Join([]string{string(job.ChainID), job.BlockHeight}, ":")

	// Tries to get the block from the cache
	block, err := service.redisCache.Get(ctx, cacheKey)
	if err != nil {
		return err
	} else {
		logger.Printf("Successfully sent query to cache for key \"%s\"\n", cacheKey)
	}

	// If the block was not found in the cache, get it from the chain and cache it
	if block == nil {
		logger.Printf("Cache does not contain a value for key \"%s\"\n", cacheKey)

		resolvedChain, err := service.chainResolver.ResolveChain(&blockchains.BlockchainOpts{
			ChainID:  blockchains.ChainID(job.ChainID),
			ChainUrl: job.ChainUrl,
		})
		if err != nil {
			return err
		} else {
			logger.Printf("Successfully resolved blockchain client for chain \"%s\"\n", job.ChainID)
		}

		blockHeight, err := strconv.ParseUint(job.BlockHeight, 10, 64)
		if err != nil {
			return err
		}

		fetchedBlock, err := resolvedChain.GetBlockAtHeight(ctx, blockHeight)
		if err != nil {
			return err
		} else {
			logger.Printf("Successfully fetched block %s from chain \"%s\"\n", job.BlockHeight, job.ChainID)
		}

		err = service.redisCache.Put(ctx, cacheKey, CachedBlock{Data: fetchedBlock})
		if err != nil {
			return err
		} else {
			logger.Printf("Successfully added block %s from chain \"%s\" to cache\n", job.BlockHeight, job.ChainID)
		}

		block = &CachedBlock{Data: fetchedBlock}
	} else {
		logger.Printf("Cache hit for block %s on chain \"%s\"\n", job.BlockHeight, job.ChainID)
	}

	// Creates a POST request
	req, err := http.NewRequestWithContext(
		ctx,
		"POST",
		job.Url,
		bytes.NewBuffer(block.Data),
	)
	if err != nil {
		return err
	} else {
		logger.Printf("Successfully created HTTP request for block %s on chain \"%s\"\n", job.BlockHeight, job.ChainID)
	}

	// Sets request headers and sends the request
	req.Header.Set("Content-Type", "application/json")
	httpClient := http.Client{Timeout: time.Duration(job.TimeoutMs) * time.Millisecond}
	_, err = httpClient.Do(req)
	if err != nil {
		// TODO: What happens if you don't ACK the job after pulling it from the stream?
		// TODO: How does DLX work?
		// TODO: How can I remove the job if it has been retried too many times?
		logger.Printf("Failed to send HTTP request for block %s on chain \"%s\": %v\n", job.BlockHeight, job.ChainID, err)
		return err
	} else {
		logger.Printf("Successfully sent HTTP request for block %s on chain \"%s\"\n", job.BlockHeight, job.ChainID)
	}

	// NOTE: if the program is terminated AFTER the HTTP request is sent
	// but BEFORE the job is fully acknowledged (i.e. right here in the
	// code), then the client will receive the same block multiple times.

	// ACKs the job
	err = service.redisClient.Do(ctx, "XACK", REDIS_WEBHOOK_JOB_STREAM_KEY, REDIS_WEBHOOK_JOB_CONSUMER_GROUP_NAME, entry.ID).Err()
	if err != nil && !errors.Is(err, redis.Nil) {
		return err
	} else {
		logger.Printf("Successfully processed job for block %s on chain \"%s\"\n", job.BlockHeight, job.ChainID)
	}

	// Returns nil if no errors occurred
	return nil
}
