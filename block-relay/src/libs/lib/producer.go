package lib

import (
	"block-relay/src/libs/blockchains"
	"block-relay/src/libs/common"
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/rabbitmq/rabbitmq-stream-go-client/pkg/amqp"
	"github.com/rabbitmq/rabbitmq-stream-go-client/pkg/stream"
)

type (
	BlockProducerOptsEnv struct {
		StreamUrl string `env:"BLOCK_PRODUCER_STREAM_URL"`
		PollMs    string `env:"BLOCK_PRODUCER_POLL_MS"`
	}

	BlockProducerOpts struct {
		StreamUrl string `validate:"required"`
		PollMs    uint64 `validate:"required,gt=0"`
	}

	BlockProducer struct {
		logger   *log.Logger
		producer *stream.Producer
		opts     *BlockProducerOpts
		chain    blockchains.IBlockchain
	}
)

func RunBlockProducer(ctx context.Context, chain blockchains.IBlockchain) error {
	// Convert the chain ID to a string
	chainId := string(chain.GetOpts().ChainID)

	// Parses env variables
	opts, err := common.ParseOpts[BlockProducerOptsEnv, BlockProducerOpts](func(env *BlockProducerOptsEnv) (*BlockProducerOpts, error) {
		pollMs, err := strconv.ParseUint(env.PollMs, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("could not parse PollMs value \"%s\" as uint64: %v", env.PollMs, err)
		}

		return &BlockProducerOpts{
			StreamUrl: env.StreamUrl,
			PollMs:    pollMs,
		}, nil
	})
	if err != nil {
		return nil
	}

	// Defines a logger
	logger := log.New(os.Stdout, "[producer-"+chainId+"] ", log.LstdFlags)

	// Logs a starting message
	logger.Printf("Setting up block producer on stream \"%s\"\n", chainId)

	// Creates a stream connection
	env, err := stream.NewEnvironment(
		stream.NewEnvironmentOptions().
			SetUri(opts.StreamUrl).
			SetMaxProducersPerClient(1),
	)
	if err != nil {
		return err
	} else {
		logger.Println("Successfully established stream connection to RabbitMQ")
		logger.Println(opts.StreamUrl)
		defer env.Close()
	}

	// Creates a stream for the input chain if one doesn't exist already
	err = declareBlockStream(env, chainId)
	if err != nil {
		return err
	} else {
		logger.Printf("Successfully declared stream \"%s\"\n", chainId)
	}

	// Creates a stream producer
	producer, err := env.NewProducer(
		chainId,
		stream.NewProducerOptions().
			SetProducerName(chainId),
	)
	if err != nil {
		return err
	} else {
		logger.Printf("Successfully declared producer \"%s\" on stream \"%s\"\n", chainId, chainId)
		defer producer.Close()
	}

	// Logs a starting message
	logger.Printf("Listening for new blocks every %d milliseconds\n", opts.PollMs)

	// Continuously poll the chain for new block data and publish it to the stream
	common.LoopUntilCancelled(ctx, func() {
		// Make logs more readable
		logger.Println("")

		// Fetch the latest block number/height
		latestBlockHeight, err := chain.GetLatestBlockHeight(ctx)
		if err != nil {
			logger.Printf("error: %v\n", err)
			return
		} else {
			logger.Printf("Latest block height is %d\n", latestBlockHeight)
		}

		// Fetch the last block number/height that was published to the stream if one exists
		lastPublishedBlockHeight, err := producer.GetLastPublishingId()
		if err != nil {
			logger.Printf("error: %v\n", err)
			return
		} else {
			logger.Printf("Last published block height is %d\n", lastPublishedBlockHeight)
		}

		// If nothing has been published to the stream, use the latest block height, otherwise
		// increment the last published height by 1 so we can process the next block
		if lastPublishedBlockHeight == 0 {
			lastPublishedBlockHeight = int64(latestBlockHeight)
			logger.Printf("Last publishing ID was not found - using the latest block height %d\n", lastPublishedBlockHeight)
		} else {
			lastPublishedBlockHeight = lastPublishedBlockHeight + 1
		}

		// Verifies that the calculated block height is not ahead of the
		// actual block height - if the calculated height is invalid, we
		// wait a moment before re-polling
		if uint64(lastPublishedBlockHeight) > latestBlockHeight {
			logger.Printf("error: current height (%d) is larger than latest block height (%d)", lastPublishedBlockHeight, latestBlockHeight)
			time.Sleep(time.Duration(opts.PollMs) * time.Millisecond)
			return
		} else {
			logger.Printf("New block detected %d\n", lastPublishedBlockHeight)
		}

		// JSON encodes the block data
		data, err := common.JsonStringify(BlockData{
			Blockchain: *chain.GetOpts(),
			Timestamp:  time.Now().Unix(),
			Height:     uint64(lastPublishedBlockHeight),
		})
		if err != nil {
			logger.Printf("error: %v\n", err)
			return
		} else {
			logger.Printf("Successfully converted data to JSON with %d bytes\n", len(data))
		}

		// Sends the block data to the stream
		msg := amqp.NewMessage([]byte(data))
		msg.SetPublishingId(lastPublishedBlockHeight)
		err = producer.Send(msg)
		if err != nil {
			logger.Printf("error: %v\n", err)
			return
		} else {
			logger.Printf("Message has been sent to stream \"%s\"\n", chain.GetOpts().ChainID)
		}

		// Waits before re-looping
		time.Sleep(time.Duration(opts.PollMs) * time.Millisecond)
	})

	// If no errors occurred - return nil
	return nil
}
