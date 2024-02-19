package common

import (
	"fmt"
	"log"
	"runtime"
)

func PickError[T any](something T, err error) error {
	return err
}

func Keys[K comparable, V any](m map[K]V) []K {
	keys := make([]K, len(m))

	i := 0
	for k := range m {
		keys[i] = k
		i++
	}

	return keys
}

func LogError(logger *log.Logger, err error) {
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
