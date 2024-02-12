package testutils

import (
	"database/sql"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func GetDatabaseClient(t *testing.T, dbUrl string, dbConnPoolSize int) (*sql.DB, error) {
	db, err := sql.Open("mysql", dbUrl)
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
