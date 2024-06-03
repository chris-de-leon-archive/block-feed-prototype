package blockstore

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type (
	TimescaleBlockStore struct {
		client *pgxpool.Pool
	}
)

func NewTimescaleBlockStore(client *pgxpool.Pool) *TimescaleBlockStore {
	return &TimescaleBlockStore{
		client: client,
	}
}

func (blockStore *TimescaleBlockStore) Init(ctx context.Context, chainID string) error {
	schema := "public"

	parsedURL, err := url.Parse(blockStore.client.Config().ConnString())
	if err != nil {
		panic(err)
	}

	searchPath := parsedURL.Query().Get("search_path")
	if searchPath != "" {
		schema = searchPath
	}

	createTable := fmt.Sprintf(
		`
      CREATE TABLE IF NOT EXISTS %s (
        "block_height" INT PRIMARY KEY, 
        "block" TEXT NOT NULL
      )
    `,
		pgx.Identifier{chainID}.Sanitize(),
	)

	createHyperTable := fmt.Sprintf(
		`
      SELECT public.create_hypertable('%s', public.by_range('block_height'), if_not_exists => TRUE);
    `,
		fmt.Sprintf("%s.%s", schema, chainID),
	)

	return pgx.BeginTxFunc(ctx, blockStore.client, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS timescaledb`); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, createTable); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, createHyperTable); err != nil {
			return err
		}
		return nil
	})
}

func (blockStore *TimescaleBlockStore) PutBlocks(ctx context.Context, chainID string, blocks []BlockDocument) error {
	var empty BlockDocument
	rowMeta := reflect.TypeOf(empty)
	numCols := rowMeta.NumField()

	sqlColNames := make([]string, numCols)
	for i := 0; i < numCols; i++ {
		sqlColNames[i] = pgx.Identifier{rowMeta.Field(i).Tag.Get("db")}.Sanitize()
	}

	sqlPlaceholders := make([]string, len(blocks))
	sqlVals := make([]any, len(blocks)*numCols)
	for i, row := range blocks {
		placeholders := make([]string, numCols)
		for j := 0; j < numCols; j++ {
			fieldName := reflect.TypeOf(row).Field(j).Name
			fieldVal := reflect.ValueOf(&row).Elem().FieldByName(fieldName).Interface()
			sqlVals[i*numCols+j] = fieldVal
			placeholders[j] = fmt.Sprintf("$%d", (i*numCols+j)+1)
		}
		sqlPlaceholders[i] = fmt.Sprintf("(%s)", strings.Join(placeholders, ","))
	}

	query := fmt.Sprintf(`INSERT INTO %s(%s) VALUES %s ON CONFLICT ("block_height") DO NOTHING`,
		pgx.Identifier{chainID}.Sanitize(),
		strings.Join(sqlColNames, ","),
		strings.Join(sqlPlaceholders, ","),
	)

	return pgx.BeginTxFunc(ctx, blockStore.client, pgx.TxOptions{}, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, query, sqlVals...)
		return err
	})
}

func (blockStore *TimescaleBlockStore) GetBlocks(ctx context.Context, chainID string, startHeight uint64, endHeight uint64) ([]BlockDocument, error) {
	if startHeight > endHeight {
		return []BlockDocument{}, nil
	}

	query := fmt.Sprintf(`
      SELECT "block_height", "block" 
      FROM %s 
      WHERE "block_height" BETWEEN $1 AND $2
      ORDER BY "block_height" ASC
    `,
		pgx.Identifier{chainID}.Sanitize(),
	)

	rows, err := blockStore.client.Query(ctx, query, startHeight, endHeight)
	if errors.Is(err, sql.ErrNoRows) {
		return []BlockDocument{}, nil
	}
	if err != nil {
		return []BlockDocument{}, err
	}

	return pgx.CollectRows(rows, pgx.RowToStructByName[BlockDocument])
}

func (blockStore *TimescaleBlockStore) GetLatestBlocks(ctx context.Context, chainID string, limit int64) ([]BlockDocument, error) {
	// Returns an empty slice if the limit is invalid
	if limit <= 0 {
		return []BlockDocument{}, nil
	}

	query := fmt.Sprintf(`
      SELECT "block_height", "block" 
      FROM %s 
      ORDER BY "block_height" DESC 
      LIMIT $1 
    `,
		pgx.Identifier{chainID}.Sanitize(),
	)

	rows, err := blockStore.client.Query(ctx, query, limit)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, pgx.RowToStructByName[BlockDocument])
}

func (blockStore *TimescaleBlockStore) GetLatestBlock(ctx context.Context, chainID string) (*BlockDocument, error) {
	blocks, err := blockStore.GetLatestBlocks(ctx, chainID, 1)
	if err != nil {
		return nil, err
	}
	if len(blocks) == 0 {
		return nil, nil
	}
	return &blocks[0], nil
}
