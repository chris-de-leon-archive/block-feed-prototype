package main

import (
	"block-relay/src/libs/blockchains/flow"
	"block-relay/src/libs/consumers"
	"block-relay/src/libs/relayer"
	"context"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	relayer.
		New(flow.Blockchain(os.Getenv("RELAYER_NETWORK_URL"))).
		Run(ctx, consumers.SMTPConsumer())
}
