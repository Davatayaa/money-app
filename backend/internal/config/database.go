package config

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

func ConnectDB() {
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")

	if dbUser == "" {
		panic("❌ Error: Environment variable kosong. Pastikan file .env terbaca!")
	}

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		dbUser, dbPass, dbHost, dbPort, dbName,
	)

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		panic("Config error: " + err.Error())
	}

	dbpool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		panic("Gagal connect database: " + err.Error())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if err := dbpool.Ping(ctx); err != nil {
		panic("❌ Database tidak merespon (Cek Tunnel!): " + err.Error())
	}

	DB = dbpool
	fmt.Println("✅ Berhasil terhubung ke Database!")
}
