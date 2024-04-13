package services

import (
	"fmt"

	"github.com/redis/go-redis/v9"
)

func extractOneStreamMessage(streams []redis.XStream, streamName string) (*redis.XMessage, error) {
	for _, stream := range streams {
		if stream.Stream == streamName {
			if len(stream.Messages) == 0 {
				return nil, nil
			}
			if len(stream.Messages) != 1 {
				return nil, fmt.Errorf("received an unexpected number of messages from stream: %v", stream.Messages)
			}
			return &stream.Messages[0], nil
		}
	}
	return nil, fmt.Errorf("stream \"%s\" not found: %v", streamName, streams)
}
