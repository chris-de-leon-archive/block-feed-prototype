package lib

import (
	"block-relay/src/libs/blockchains"
	"errors"

	rmq "github.com/rabbitmq/amqp091-go"
	"github.com/rabbitmq/rabbitmq-stream-go-client/pkg/stream"
)

type (
	WebhookData struct {
		Url          string
		Block        []byte
		RetryDelayMs uint64 // NOTE: should be gt 0
		MaxRetries   uint64 // NOTE: should be gt 0
	}

	BlockData struct {
		Blockchain blockchains.BlockchainOpts
		Timestamp  int64
		Height     uint64
	}
)

func declareDurableQueueWithChan(ch *rmq.Channel, queueName string) (*rmq.Queue, error) {
	queue, err := ch.QueueDeclare(
		queueName, // name
		true,      // durable
		false,     // autoDelete
		false,     // exclusive
		false,     // noWait
		nil,       // args
	)
	if err != nil {
		return nil, err
	} else {
		return &queue, err
	}
}

func declareDurableQueueWithConn(conn *rmq.Connection, queueName string) (*rmq.Queue, error) {
	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	} else {
		defer ch.Close()
	}

	return declareDurableQueueWithChan(ch, queueName)
}

func declareBlockStream(env *stream.Environment, streamName string) error {
	err := env.DeclareStream(
		streamName,
		stream.NewStreamOptions().
			SetMaxLengthBytes(stream.ByteCapacity{}.GB(2)),
	)

	if err != nil && !errors.Is(err, stream.StreamAlreadyExists) {
		return err
	}

	return nil
}
