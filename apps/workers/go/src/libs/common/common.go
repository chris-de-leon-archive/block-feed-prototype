package common

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"math/rand"
	"runtime"
	"time"
)

func ExponentialBackoff[T any](
	ctx context.Context,
	initWaitMs int,
	maxRetries int,
	maxRandMs int,
	cb func(retryCount int) (T, error),
) (T, error) {
	var empty T
	if maxRetries == 0 {
		return empty, errors.New("retry limit exceeded")
	}

	retryCount := 0
	if result, err := cb(retryCount); err == nil {
		return result, nil
	} else {
		retryCount += 1
		if retryCount >= maxRetries {
			return empty, errors.New("retry limit exceeded")
		}
	}

	timer := time.NewTimer(time.Duration(initWaitMs+rand.Intn(maxRandMs)) * time.Millisecond)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return empty, ctx.Err()
		case _, ok := <-timer.C:
			if !ok {
				return empty, nil
			}
			result, err := cb(retryCount)
			if err == nil {
				return result, nil
			}
		}

		retryCount += 1
		if retryCount >= maxRetries {
			return empty, errors.New("retry limit exceeded")
		} else {
			waitMs := math.Pow(float64(initWaitMs), float64(retryCount)) + float64(rand.Intn(maxRandMs))
			timer.Reset(time.Duration(waitMs) * time.Millisecond)
		}
	}
}

func LogError(logger *log.Logger, err error) {
	if err == nil {
		return
	}

	_, file, line, ok := runtime.Caller(1)
	if !ok {
		file = "unknown"
		line = -1
	}

	msg := "Error at %s:%d - %v\n"
	if logger == nil {
		fmt.Printf(msg, file, line, err)
	} else {
		logger.Printf(msg, file, line, err)
	}
}
