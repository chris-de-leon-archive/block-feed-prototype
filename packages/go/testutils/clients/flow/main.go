package flow

import (
	"testing"

	"github.com/onflow/flow-go-sdk/access/grpc"
)

func GetFlowClient(t *testing.T, url string) (*grpc.Client, error) {
	client, err := grpc.NewClient(url)
	if err != nil {
		return nil, err
	}

	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Log(err)
		}
	})

	return client, err
}
