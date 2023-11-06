package consumers

import (
	"block-relay/src/libs/common"
	"block-relay/src/libs/relayer"
	"bytes"
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
)

type (
	RawHTTPConsumerOpts struct {
		RetryDelayMs string `env:"RELAYER_HTTP_RETRY_DELAY_MS"`
		MaxRetries   string `env:"RELAYER_HTTP_MAX_RETRIES"`
		Url          string `env:"RELAYER_HTTP_URL"`
	}

	HTTPConsumerOpts struct {
		RetryDelayMs int    `validate:"required,gte=0"`
		MaxRetries   int    `validate:"required,gte=0"`
		Url          string `validate:"required"`
	}
)

func HTTPConsumer() func(ctx context.Context, data relayer.RelayerQueueData) error {
	// Creates a logger
	logger := log.New(os.Stdout, "[http] ", log.LstdFlags)

	// Creates an HTTP client
	httpClient := &http.Client{}

	// Parses environment variables
	opts := common.ParseOpts[RawHTTPConsumerOpts, HTTPConsumerOpts](func(env *RawHTTPConsumerOpts) *HTTPConsumerOpts {
		return &HTTPConsumerOpts{
			RetryDelayMs: common.PanicIfError(strconv.Atoi(env.RetryDelayMs)),
			MaxRetries:   common.PanicIfError(strconv.Atoi(env.MaxRetries)),
			Url:          env.Url,
		}
	})

	// Returns an HTTP consumer
	return func(ctx context.Context, data relayer.RelayerQueueData) error {
		// Creates a POST request
		req, err := http.NewRequestWithContext(
			ctx,
			"POST",
			opts.Url,
			bytes.NewBuffer(data.Block),
		)
		if err != nil {
			return err
		}

		// Sets the request headers
		req.Header.Set("Content-Type", "application/json")

		// Sends the request
		_, err = common.RetryIfError[*http.Response](
			opts.MaxRetries,
			common.ConstantDelay(opts.RetryDelayMs),
			func() (*http.Response, error) {
				return httpClient.Do(req)
			},
		)

		// Logs results
		logger.Printf("sent block %d to %s\n", data.Height, opts.Url)

		// Returns an error if any
		return err
	}
}
