package testutils

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os/exec"
	"reflect"
	"strings"
)

func GetRootDir() (string, error) {
	var out bytes.Buffer

	cmd := exec.Command("git", "rev-parse", "--show-toplevel")
	cmd.Stdout = &out

	if err := cmd.Run(); err != nil {
		return "", err
	}

	return strings.ReplaceAll(out.String(), "\n", ""), nil
}

func JsonParse[T any](jsonStr string) (T, error) {
	var result T
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		var empty T
		return empty, err
	}
	return result, nil
}

func GetFreePort() (port int, err error) {
	addr, err := net.ResolveTCPAddr("tcp", "localhost:0")
	if err != nil {
		return 0, err
	}

	listener, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 0, err
	} else {
		defer listener.Close()
	}

	tcpAddr, ok := listener.Addr().(*net.TCPAddr)
	if !ok {
		return 0, errors.New("failed to convert listener address to a TCP address")
	} else {
		return tcpAddr.Port, nil
	}
}

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
