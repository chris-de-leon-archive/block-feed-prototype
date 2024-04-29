package testutils

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
)

func GetCurrentDir() (*string, error) {
	// Get the file path and line number of the calling function
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return nil, fmt.Errorf("failed to get file path")
	}

	// Convert the relative path to an absolute path
	absDirPath, err := filepath.Abs(filepath.Dir(filename))
	if err != nil {
		return nil, err
	}

	// Returns the absolute path
	return &absDirPath, nil
}

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

func JsonStringify(data any) ([]byte, error) {
	bytes, err := json.MarshalIndent(data, "", " ")
	if err != nil {
		return []byte{}, err
	}
	return bytes, nil
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
