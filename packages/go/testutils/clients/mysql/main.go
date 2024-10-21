package mysql

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func GetMySqlClient(t *testing.T, url string, dbConnPoolSize int) (*sql.DB, error) {
	db, err := sql.Open("mysql", url)
	if err != nil {
		return nil, err
	} else {
		db.SetConnMaxLifetime(time.Duration(30) * time.Second)
		db.SetMaxOpenConns(dbConnPoolSize)
		db.SetMaxIdleConns(dbConnPoolSize)
	}

	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Log(err)
		}
	})

	return db, nil
}

func GetTempMySqlClient[T any](url string, dbConnPoolSize int, cb func(client *sql.DB) (T, error)) (T, error) {
	var empty T

	client, err := sql.Open("mysql", url)
	if err != nil {
		return empty, err
	} else {
		client.SetConnMaxLifetime(time.Duration(30) * time.Second)
		client.SetMaxOpenConns(dbConnPoolSize)
		client.SetMaxIdleConns(dbConnPoolSize)
	}

	defer func() {
		if err := client.Close(); err != nil {
			fmt.Println(err)
		}
	}()

	return cb(client)
}
