package models

import "time"

type Transaction struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	WalletID    int64     `json:"wallet_id" validate:"required"`
	CategoryID  int64     `json:"category_id" validate:"required"`
	Amount      float64   `json:"amount" validate:"required,min=1"`
	Type        string    `json:"type" validate:"required,oneof=EXPENSE INCOME"`
	Date        time.Time `json:"date"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	PhotoURL    string    `json:"photo_url,omitempty"`

	CategoryName string `json:"category_name,omitempty"`
	WalletName   string `json:"wallet_name,omitempty"`

	RelatedTransactionID *int64 `json:"related_transaction_id"`
}

type TransferRequest struct {
	FromWalletID int64   `json:"from_wallet_id"`
	ToWalletID   int64   `json:"to_wallet_id"`
	Amount       float64 `json:"amount"`
	Date         string  `json:"date"`
	Description  string  `json:"description"`
}

type MonthlyTrend struct {
	Month   int     `json:"month"`
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
}
