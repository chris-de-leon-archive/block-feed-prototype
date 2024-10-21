package eth

import (
	"testing"

	"github.com/ethereum/go-ethereum/ethclient"
)

func GetEthClient(t *testing.T, url string) (*ethclient.Client, error) {
	client, err := ethclient.Dial(url)
	if err != nil {
		return nil, err
	}

	t.Cleanup(func() {
		client.Close()
	})

	return client, err
}
