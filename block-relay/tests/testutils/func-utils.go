package testutils

import (
	"encoding/json"
	"fmt"
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

func GetBulkInsertQuery[T any](tableName string, rows []T) (string, []any) {
	var empty T
	rowMeta := reflect.TypeOf(empty)
	numCols := rowMeta.NumField()

	sqlTemplates := make([]string, len(rows))
	sqlVals := make([]any, len(rows)*numCols)
	for i, r := range rows {
		sqlTemplates[i] = fmt.Sprintf("(%s)", strings.Repeat("?, ", numCols-1)+"?")
		for j := 0; j < numCols; j++ {
			sqlVals[i*numCols+j] = reflect.
				ValueOf(&r).
				Elem().
				FieldByName(
					reflect.
						TypeOf(r).
						Field(j).
						Name,
				).
				Interface()
		}
	}

	return fmt.Sprintf(
			"INSERT INTO `%s` VALUES %s",
			tableName,
			strings.Join(sqlTemplates, ","),
		),
		sqlVals
}
