package models

import (
	"errors"
	"time"
)

var ErrWalletNotFound = errors.New("wallet not found")

type Wallet struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	Name        string    `json:"name" validate:"required"`
	Type        string    `json:"type" validate:"required"`
	Currency    string    `json:"currency" validate:"required,len=3"`
	Balance     float64   `json:"balance"`
	CreatedAt   time.Time `json:"created_at"`
	MonthlyFlow float64   `json:"monthly_flow"`
}
