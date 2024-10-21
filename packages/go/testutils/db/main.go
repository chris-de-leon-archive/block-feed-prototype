package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"reflect"
	"strings"
)

func GetBulkInsertQuery[T any](tableName string, rows []T) (string, []any) {
	var empty T
	rowMeta := reflect.TypeOf(empty)
	numCols := rowMeta.NumField()

	sqlPlaceholders := make([]string, len(rows))
	sqlVals := make([]any, len(rows)*numCols)
	for i, row := range rows {
		sqlPlaceholders[i] = fmt.Sprintf("(%s)", strings.Repeat("?, ", numCols-1)+"?")
		for j := 0; j < numCols; j++ {
			colName := reflect.TypeOf(row).Field(j).Name
			colItem := reflect.ValueOf(&row).Elem().FieldByName(colName).Interface()
			sqlVals[i*numCols+j] = colItem
		}
	}

	sqlQuery := fmt.Sprintf("INSERT INTO `%s` VALUES %s",
		tableName,
		strings.Join(sqlPlaceholders, ","),
	)

	return sqlQuery, sqlVals
}

func WithTx(ctx context.Context, db *sql.DB, cb func(tx *sql.Tx) error, opts *sql.TxOptions) error {
	tx, err := db.BeginTx(ctx, opts)
	if err != nil {
		return err
	} else {
		defer func() {
			if err := tx.Rollback(); err != nil && errors.Is(err, sql.ErrTxDone) {
				return
			}
		}()
	}

	if err := cb(tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}
