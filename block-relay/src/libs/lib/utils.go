package lib

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

const (
	POSTGRES_WEBHOOK_JOB_CHANNEL_NAME     = "webhook-job-channel"
	REDIS_WEBHOOK_JOB_CONSUMER_GROUP_NAME = "webhook-job-consumers"
	REDIS_WEBHOOK_JOB_CURSOR_KEY          = "webhook-job-cursor"
	REDIS_WEBHOOK_JOB_STREAM_NAME         = "webhook-job-stream"
	REDIS_WEBHOOK_JOB_STREAM_KEY          = "webhook-job"
)

type (
	StreamEntry struct {
		Data map[string]string
		ID   string
	}
)

func readStreamEntries(
	ctx context.Context,
	redisClient *redis.Client,
	consumerGroupName string,
	consumerName string,
	streamName string,
	streamId string,
	count int,
	blockTimeoutMs int,
) ([]StreamEntry, error) {
	// Defines an empty StreamEntry slice
	var empty []StreamEntry

	// Reads the data from the specified stream using a consumer group
	result, err := redisClient.Do(ctx,
		"XREADGROUP",
		"GROUP", consumerGroupName, consumerName,
		"COUNT", count,
		"BLOCK", blockTimeoutMs,
		"STREAMS", streamName, streamId,
	).Result()
	if err != nil {
		return empty, err
	}

	// Converts the result to a map
	resultMap, ok := result.(map[any]any)
	if !ok {
		return empty, fmt.Errorf("could not convert result to a map: %v", result)
	}

	// Creates a map where each key is a stream name and each value is a slice of the stream's data
	streams := map[string][]any{}
	for k, v := range resultMap {
		key, ok := k.(string)
		if !ok {
			return empty, fmt.Errorf("could not convert key to a string: %v", k)
		}
		val, ok := v.([]any)
		if !ok {
			return empty, fmt.Errorf("could not convert value to a slice: %v", v)
		}
		streams[key] = val
	}

	// Fetches the data for the input stream
	records, exists := streams[streamName]
	if !exists {
		return empty, fmt.Errorf("key %s does not exist in stream entry: %v", streamName, streams)
	}

	// Iterates over the stream data and parses it
	streamEntries := []StreamEntry{}
	for _, record := range records {
		// Converts the current record to a slice
		pair, ok := record.([]any)
		if !ok {
			return empty, fmt.Errorf("could not convert stream record to the correct type: %v", record)
		}

		// Validates that the current record has at least two items
		if len(pair) < 2 {
			return empty, fmt.Errorf("stream record contains an invalid number of elements: %v", pair)
		}

		// The first element of the pair should be the ID of the record
		id, ok := pair[0].(string)
		if !ok {
			return empty, fmt.Errorf("could not convert stream ID to string: %v", pair[0])
		}

		// The second element of the pair should be the data associated with
		// the record. The data is a slice with the following format:
		//
		//  [key1, value1, key2, value2, ...]
		//
		entries, ok := pair[1].([]any)
		if !ok {
			return empty, fmt.Errorf("could not convert stream entries to string slice: %v", pair[1])
		}

		// Loads the data into a map
		data := map[string]string{}
		for i, entry := range entries {
			if i%2 != 0 {
				key, ok := entries[i-1].(string)
				if !ok {
					return empty, fmt.Errorf("could not parse stream entry key: %v", entries[i-1])
				}
				val, ok := entry.(string)
				if !ok {
					return empty, fmt.Errorf("could not parse stream entry value: %v", entry)
				}
				data[key] = val
			}
		}

		// Creates a struct with the ID and the data
		streamEntries = append(streamEntries, StreamEntry{
			Data: data,
			ID:   id,
		})
	}

	// Returns a slice with all the parsed entries
	return streamEntries, nil
}
