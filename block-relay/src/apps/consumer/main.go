package main

import (
	"block-relay/src/libs/lib"
	"context"
	"os/signal"
	"syscall"
)

func main() {
	// Close the context when a stop/kill signal is received
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Runs the block consumer until the context is cancelled
	err := lib.RunBlockConsumer(ctx)
	if err != nil {
		panic(err)
	}
}
