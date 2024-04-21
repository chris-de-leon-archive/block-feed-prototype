package db

import (
	"block-feed/src/libs/sqlc"
	"context"
	"database/sql"
	"errors"
)

type Database struct {
	Queries *sqlc.Queries
	client  *sql.DB
}

func NewDatabase(client *sql.DB) *Database {
	return &Database{
		Queries: sqlc.New(client),
		client:  client,
	}
}

func (database *Database) WithTx(
	ctx context.Context,
	cb func(queries *sqlc.Queries) error,
	opts *sql.TxOptions,
) error {
	tx, err := database.client.BeginTx(ctx, opts)
	if err != nil {
		return err
	} else {
		defer func() {
			if err := tx.Rollback(); err != nil && errors.Is(err, sql.ErrTxDone) {
				return
			}
		}()
	}

	if err := cb(database.Queries.WithTx(tx)); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}
