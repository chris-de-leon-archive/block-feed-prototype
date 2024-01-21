package lib

import (
	"block-relay/src/libs/common"
	"context"
	"fmt"
	"log"
	"os"
	"time"

	rmq "github.com/rabbitmq/amqp091-go"
	"github.com/rabbitmq/rabbitmq-stream-go-client/pkg/amqp"
	"github.com/rabbitmq/rabbitmq-stream-go-client/pkg/stream"
)

type (
	BlockSplitterOptsEnv struct {
		StreamUrl    string `env:"BLOCK_SPLITTER_STREAM_URL"`
		StreamName   string `env:"BLOCK_SPLITTER_STREAM_NAME"`
		QueueUrl     string `env:"BLOCK_SPLITTER_QUEUE_URL"`
		QueueName    string `env:"BLOCK_SPLITTER_QUEUE_NAME"`
		SplitterName string `env:"BLOCK_SPLITTER_NAME"`
	}

	BlockSplitterOpts struct {
		StreamUrl    string `validate:"required"`
		StreamName   string `validate:"required"` // TODO: validate length is not 0
		QueueUrl     string `validate:"required"` // TODO: validate length is not 0
		QueueName    string `validate:"required"` // TODO: validate length is not 0
		SplitterName string `validate:"required"` // TODO: validate length is not 0
	}

	BlockSplitter struct {
		rmqConn *rmq.Connection
		rmqChan *rmq.Channel
		logger  *log.Logger
		opts    *BlockSplitterOpts
	}
)

func RunBlockSplitter(ctx context.Context) error {
	// Parses env variables
	opts, err := common.ParseOpts[BlockSplitterOptsEnv, BlockSplitterOpts](func(env *BlockSplitterOptsEnv) (*BlockSplitterOpts, error) {
		return &BlockSplitterOpts{
			StreamUrl:    env.StreamUrl,
			StreamName:   env.StreamName,
			QueueUrl:     env.QueueUrl,
			QueueName:    env.QueueName,
			SplitterName: env.SplitterName,
		}, nil
	})
	if err != nil {
		return err
	}

	// Defines a logger
	logger := log.New(os.Stdout, "["+opts.SplitterName+"] ", log.LstdFlags)

	// Logs a starting message
	logger.Printf("Setting up block splitter on stream \"%s\"\n", opts.StreamName)

	// Creates a RMQ connection
	conn, err := rmq.Dial(opts.QueueUrl)
	if err != nil {
		return err
	} else {
		logger.Println("Successfully established AMQP connection to RabbitMQ")
		defer conn.Close()
	}

	// Creates a RMQ channel
	ch, err := conn.Channel()
	if err != nil {
		return err
	} else {
		logger.Println("Successfully opened RabbitMQ channel on AMQP connection")
		defer ch.Close()
	}

	// Ensures that the consumer queue exists
	queue, err := declareDurableQueueWithChan(ch, opts.QueueName)
	if err != nil {
		return err
	} else {
		logger.Printf("Successfully declared queue \"%s\"\n", queue.Name)
	}

	// Enables transaction mode so we can publish messages in batches
	// This is done AFTER we declare the queue so that the queue doesn't need to be declared with a transaction
	if err := ch.Tx(); err != nil {
		return err
	} else {
		logger.Println("Successfully enabled transation mode")
	}

	// Connects to the RMQ stream
	env, err := stream.NewEnvironment(
		stream.NewEnvironmentOptions().
			SetUri(opts.StreamUrl).
			SetMaxProducersPerClient(1),
	)
	if err != nil {
		return err
	} else {
		logger.Println("Successfully established stream connection to RabbitMQ")
		defer env.Close()
	}

	// Creates a stream for the input chain if one doesn't exist already
	err = declareBlockStream(env, opts.StreamName)
	if err != nil {
		return err
	} else {
		logger.Printf("Successfully declared stream \"%s\"\n", opts.StreamName)
	}

	// Sets consumer options
	consumerOpts := stream.NewConsumerOptions().
		SetConsumerName(opts.SplitterName).
		SetAutoCommit(
			stream.NewAutoCommitStrategy().
				SetCountBeforeStorage(1).          // Commit the offset after each block is processed
				SetFlushInterval(5 * time.Second), // OR commit every 5 seconds (even if there's nothing to commit)
		)

	// TODO: notify the database that this splitter exists and rebalance tables if necessary

	// Logs starting message
	logger.Println("Ready to process stream messages")

	// Listens for new block data
	consumer, err := env.NewConsumer(opts.StreamName, func(_ stream.ConsumerContext, message *amqp.Message) {
		// Returns early if there's no data to process
		if len(message.Data) == 0 {
			logger.Println("No messages received")
			return
		} else {
			logger.Printf("%d message(s) received\n", len(message.Data))
		}

		// Clears any existing transactions on this channel (in case a previous handler failed)
		if err := ch.TxRollback(); err != nil {
			logger.Printf("error: %v\n", err)
			return
		} else {
			logger.Println("Rolling back any existing transactions")
		}

		// TODO: fetch records from DB using sqlc (assume the number of rows can fit into memory)

		urls := []string{"http://localhost:3000"}
		for _, url := range urls {
			body, err := common.JsonStringify(&WebhookData{
				RetryDelayMs: 1000,
				MaxRetries:   1,
				BlockData:    message.GetData(),
				Url:          url,
			})
			if err != nil {
				logger.Printf("error: %v\n", err)
				return
			} else {
				logger.Printf("Successfully converted data to JSON encoded string with %d bytes", len(body))
			}

			// Publishes a batch of messages
			err = ch.PublishWithContext(
				ctx,        // context
				"",         // exchange
				queue.Name, // routing key
				false,      // mandatory
				false,      // immediate
				rmq.Publishing{
					ContentType: "application/json",
					Body:        []byte(body),
				},
			)
			if err != nil {
				logger.Printf("error: %v\n", err)
				return
			} else {
				logger.Println("Successfully added publish command to transaction")
			}
		}

		// Commits the transaction
		if err := ch.TxCommit(); err != nil {
			fmt.Printf("error: %v\n", err)
			return
		} else {
			logger.Printf("Successfully committed transaction with %d message(s)", len(urls))
		}
	}, consumerOpts)

	// Handles consumer creation errors
	if err != nil {
		return err
	} else {
		defer consumer.Close()
	}

	// Waits for the context to be cancelled
	<-ctx.Done()

	// If no errors occurred - return nil
	return nil
}
