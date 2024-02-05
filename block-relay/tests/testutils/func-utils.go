package testutils

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"runtime"
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
