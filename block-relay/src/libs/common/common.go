package common

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
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

func LoadFromEnv[T any]() *T {
	var envVariables T

	// Load values from env into the struct
	elem := reflect.ValueOf(&envVariables).Elem()
	for i := 0; i < elem.NumField(); i++ {
		if tag := elem.Type().Field(i).Tag.Get("env"); tag != "" {
			if envValue := os.Getenv(tag); envValue != "" {
				elem.Field(i).SetString(envValue)
			}
		}
	}

	// Validate the env variables
	err := validator.New().Struct(envVariables)
	if err != nil {
		panic(err)
	}

	return &envVariables
}

func ParseOpts[T any, R any](parse func(*T) *R) *R {
	// Fetches the relayer options from environment
	env := LoadFromEnv[T]()

	// Parses the environment variables
	opts := parse(env)

	// Validates the relayer options
	err := validate.Struct(opts)
	if err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			panic(validationErrors[0].Translate(trans))
		}
		panic(err)
	}

	// Returns the parsed relayer options
	return opts
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

	err := json.Unmarshal([]byte(jsonStr), &result)
	if err != nil {
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
	err = json.Unmarshal(data, &result)
	if err != nil {
		return empty, err
	}

	return result, nil
}

func Map[T any, R any](s []T, fn func(T, int) R) []R {
	mapped := []R{}
	for i, elem := range s {
		mapped = append(mapped, fn(elem, i))
	}
	return mapped
}

func MergeMaps(maps ...map[string]any) map[string]any {
	merged := map[string]any{}
	for _, m := range maps {
		for k, v := range m {
			merged[k] = v
		}
	}
	return merged
}

func ForEach[T any](s []T, fn func(T, int)) {
	for i, elem := range s {
		fn(elem, i)
	}
}

func PanicIfError[V any](val V, err error) V {
	if err != nil {
		panic(err)
	}
	return val
}

func RetryIfError[V any](maxAttempts int, onError func(error, int, int), fn func() (V, error)) (V, error) {
	var (
		attempts = 0
		empty    V
	)

	for attempts < maxAttempts {
		// Run the callback
		v, err := fn()

		// Return immediately on context errors
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			return empty, err
		}

		// Retry on any other type of error
		if err != nil {
			attempts += 1
			onError(err, attempts, maxAttempts)
			continue
		}

		// Return on success
		return v, nil
	}

	return empty, fmt.Errorf("retry limit of %d reached", maxAttempts)
}

func ConstantDelay(delayMs int) func(err error, currentAttempts int, maxAttempts int) {
	return func(err error, currentAttempts int, maxAttempts int) {
		fmt.Printf("%v (attempt %d of %d)\n", err, currentAttempts, maxAttempts)
		if currentAttempts < maxAttempts {
			time.Sleep(time.Duration(delayMs) * time.Millisecond)
		}
	}
}

func LoopUntilCancelled(ctx context.Context, fn func()) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			fn()
		}
	}
}
