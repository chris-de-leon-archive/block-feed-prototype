package common

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"runtime"
	"time"

	locales_en "github.com/go-playground/locales/en"
	ut "github.com/go-playground/universal-translator"
	"github.com/go-playground/validator/v10"
	translations_en "github.com/go-playground/validator/v10/translations/en"
)

const (
	CHARSET = "UTF-8"
)

var (
	validate = validator.New()
	en_local = locales_en.New()
	trans, _ = ut.New(en_local, en_local).GetTranslator("en")
)

func init() {
	// Makes errors more human-readable
	translations_en.RegisterDefaultTranslations(validate, trans)
}

func ValidateStruct[T any](data T) error {
	return validate.Struct(data)
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

func JsonStringify(data any) (string, error) {
	b, err := json.MarshalIndent(data, "", " ")
	if err != nil {
		var empty string
		return empty, err
	}
	return string(b), nil
}

func JsonParse[T any](jsonStr string) (T, error) {
	var result T
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		var empty T
		return empty, err
	}
	return result, nil
}

func MapToStruct[T any, K comparable, V any](m map[K]V) (T, error) {
	var empty T

	data, err := json.Marshal(m)
	if err != nil {
		return empty, err
	}

	var result T
	if err = json.Unmarshal(data, &result); err != nil {
		return empty, err
	}

	return result, nil
}

func RetryIfError[V any](maxAttempts uint64, onError func(error, uint64, uint64), fn func() (V, error)) (*V, error) {
	attempts := uint64(0)

	for attempts < maxAttempts {
		// Runs the callback
		v, err := fn()

		// Returns immediately on context errors
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			return nil, err
		}

		// Retries on any other type of error
		if err != nil {
			attempts += 1
			onError(err, attempts, maxAttempts)
			continue
		}

		// Returns on success
		return &v, nil
	}

	return nil, fmt.Errorf("retry limit of %d exceeded", maxAttempts)
}

func ConstantDelay(logger *log.Logger, delayMs uint64, logErrors bool) func(err error, currentAttempts uint64, maxAttempts uint64) {
	return func(err error, currentAttempts uint64, maxAttempts uint64) {
		if logErrors {
			logger.Printf("%v (attempt %d of %d)\n", err, currentAttempts, maxAttempts)
		}
		if currentAttempts < maxAttempts {
			time.Sleep(time.Duration(delayMs) * time.Millisecond)
		}
	}
}
