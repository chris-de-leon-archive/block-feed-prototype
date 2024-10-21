package pg

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func GetPostgresClient(t *testing.T, ctx context.Context, url string) (*pgxpool.Pool, error) {
	client, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}

	t.Cleanup(func() {
		client.Close()
	})

	return client, nil
}
