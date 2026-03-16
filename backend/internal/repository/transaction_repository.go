package repository

import (
	"context"
	"errors"
	"money-app-backend/internal/models"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TransactionRepository interface {
	CreateTransaction(ctx context.Context, trx *models.Transaction) error
	GetTransactions(ctx context.Context, userID int64, limit int, offset int) ([]models.Transaction, error)
	GetTransactionsByMonth(ctx context.Context, userID int64, month int, year int) ([]models.Transaction, error)
	GetDashboardStats(ctx context.Context, userID int64, month int, year int) (models.DashboardResponse, error)
	GetYearlyTrend(ctx context.Context, userID int64, year int) ([]models.MonthlyTrend, error) // 🔥 FITUR BARU UNTUK STATS PAGE
	UpdateTransaction(ctx context.Context, trx *models.Transaction) error
	DeleteTransaction(ctx context.Context, id int64, userID int64) error
	UpdatePhoto(ctx context.Context, id int64, photoPath string) error
}

type transactionRepository struct {
	db *pgxpool.Pool
}

func NewTransactionRepository(db *pgxpool.Pool) TransactionRepository {
	return &transactionRepository{db: db}
}

func (r *transactionRepository) CreateTransaction(ctx context.Context, trx *models.Transaction) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	queryInsert := `
		INSERT INTO transactions (user_id, wallet_id, category_id, amount, transaction_type, transaction_date, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`
	if trx.Date.IsZero() {
		trx.Date = time.Now()
	}
	trx.CreatedAt = time.Now()

	err = tx.QueryRow(ctx, queryInsert,
		trx.UserID, trx.WalletID, trx.CategoryID,
		trx.Amount, trx.Type, trx.Date, trx.Description, trx.CreatedAt,
	).Scan(&trx.ID)

	if err != nil {
		return err
	}

	var queryUpdateWallet string
	if trx.Type == "EXPENSE" {
		queryUpdateWallet = `UPDATE wallets SET balance = balance - $1 WHERE id = $2 AND user_id = $3`
	} else {
		queryUpdateWallet = `UPDATE wallets SET balance = balance + $1 WHERE id = $2 AND user_id = $3`
	}

	res, err := tx.Exec(ctx, queryUpdateWallet, trx.Amount, trx.WalletID, trx.UserID)
	if err != nil {
		return err
	}

	if res.RowsAffected() == 0 {
		return errors.New("wallet not found or not owned by user")
	}

	return tx.Commit(ctx)
}

func (r *transactionRepository) GetTransactions(ctx context.Context, userID int64, limit int, offset int) ([]models.Transaction, error) {
	query := `
		SELECT 
			t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.transaction_type, t.transaction_date, t.description, t.created_at, t.photo_url,
			c.name as category_name,
			w.name as wallet_name
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		LEFT JOIN wallets w ON t.wallet_id = w.id
		WHERE t.user_id = $1
		ORDER BY t.transaction_date DESC, t.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []models.Transaction
	for rows.Next() {
		var trx models.Transaction
		var photoURL *string

		err := rows.Scan(
			&trx.ID, &trx.UserID, &trx.WalletID, &trx.CategoryID,
			&trx.Amount, &trx.Type, &trx.Date, &trx.Description, &trx.CreatedAt, &photoURL,
			&trx.CategoryName, &trx.WalletName,
		)
		if err != nil {
			return nil, err
		}

		if photoURL != nil {
			trx.PhotoURL = *photoURL
		}

		transactions = append(transactions, trx)
	}

	if transactions == nil {
		transactions = []models.Transaction{}
	}
	return transactions, nil
}

func (r *transactionRepository) GetTransactionsByMonth(ctx context.Context, userID int64, month int, year int) ([]models.Transaction, error) {
	query := `
		SELECT 
			t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.transaction_type, t.transaction_date, t.description, t.created_at, t.photo_url,
			c.name as category_name,
			w.name as wallet_name
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		LEFT JOIN wallets w ON t.wallet_id = w.id
		WHERE t.user_id = $1
		AND CAST(EXTRACT(MONTH FROM t.transaction_date) AS INT) = $2
		AND CAST(EXTRACT(YEAR FROM t.transaction_date) AS INT) = $3
		ORDER BY t.transaction_date DESC, t.created_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID, month, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []models.Transaction
	for rows.Next() {
		var trx models.Transaction
		var photoURL *string

		err := rows.Scan(
			&trx.ID, &trx.UserID, &trx.WalletID, &trx.CategoryID,
			&trx.Amount, &trx.Type, &trx.Date, &trx.Description, &trx.CreatedAt, &photoURL,
			&trx.CategoryName, &trx.WalletName,
		)
		if err != nil {
			return nil, err
		}
		if photoURL != nil {
			trx.PhotoURL = *photoURL
		}
		transactions = append(transactions, trx)
	}

	if transactions == nil {
		transactions = []models.Transaction{}
	}
	return transactions, nil
}

func (r *transactionRepository) GetDashboardStats(ctx context.Context, userID int64, month int, year int) (models.DashboardResponse, error) {
	var response models.DashboardResponse

	query := `
		SELECT 
			c.name, c.type, c.color, c.icon, SUM(t.amount) as total
		FROM transactions t
		JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = $1
		  AND CAST(EXTRACT(MONTH FROM t.transaction_date) AS INT) = $2
		  AND CAST(EXTRACT(YEAR FROM t.transaction_date) AS INT) = $3
		  AND c.name NOT ILIKE 'Transfer%' 
		  AND c.name NOT ILIKE 'Balance Adjustment%' 
		  AND c.name NOT ILIKE 'Pindah Dana%'
		  AND t.description NOT ILIKE 'Balance Adjustment%'
		GROUP BY c.id, c.name, c.type, c.color, c.icon
		ORDER BY total DESC
	`

	rows, err := r.db.Query(ctx, query, userID, month, year)
	if err != nil {
		return response, err
	}
	defer rows.Close()

	var stats []models.CategoryStat
	var totalExpense, totalIncome float64

	for rows.Next() {
		var s models.CategoryStat
		if err := rows.Scan(&s.CategoryName, &s.Type, &s.Color, &s.Icon, &s.TotalAmount); err != nil {
			return response, err
		}

		if s.Type == "EXPENSE" {
			totalExpense += s.TotalAmount
		} else {
			totalIncome += s.TotalAmount
		}

		stats = append(stats, s)
	}

	if stats == nil {
		stats = []models.CategoryStat{}
	}

	response.Stats = stats
	response.TotalExpense = totalExpense
	response.TotalIncome = totalIncome

	return response, nil
}

func (r *transactionRepository) GetYearlyTrend(ctx context.Context, userID int64, year int) ([]models.MonthlyTrend, error) {
	query := `
		SELECT 
			CAST(EXTRACT(MONTH FROM transaction_date) AS INT) as month,
			SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END) as income,
			SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END) as expense
		FROM transactions
		WHERE user_id = $1 AND CAST(EXTRACT(YEAR FROM transaction_date) AS INT) = $2
		GROUP BY month
		ORDER BY month ASC
	`

	rows, err := r.db.Query(ctx, query, userID, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trends []models.MonthlyTrend
	for rows.Next() {
		var m models.MonthlyTrend
		if err := rows.Scan(&m.Month, &m.Income, &m.Expense); err != nil {
			return nil, err
		}
		trends = append(trends, m)
	}

	if trends == nil {
		trends = []models.MonthlyTrend{}
	}
	return trends, nil
}

func (r *transactionRepository) UpdateTransaction(ctx context.Context, trx *models.Transaction) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var oldWalletID int64
	var oldAmount float64
	var oldType string

	err = tx.QueryRow(ctx, "SELECT wallet_id, amount, transaction_type FROM transactions WHERE id=$1 AND user_id=$2", trx.ID, trx.UserID).Scan(&oldWalletID, &oldAmount, &oldType)
	if err != nil {
		return errors.New("transaction not found")
	}

	if oldType == "EXPENSE" {
		_, err = tx.Exec(ctx, "UPDATE wallets SET balance = balance + $1 WHERE id = $2", oldAmount, oldWalletID)
	} else {
		_, err = tx.Exec(ctx, "UPDATE wallets SET balance = balance - $1 WHERE id = $2", oldAmount, oldWalletID)
	}
	if err != nil {
		return err
	}

	queryUpdate := `
		UPDATE transactions 
		SET wallet_id = $1, category_id = $2, amount = $3, transaction_type = $4, 
			description = $5, transaction_date = $6
		WHERE id = $7 AND user_id = $8
	`
	_, err = tx.Exec(ctx, queryUpdate, trx.WalletID, trx.CategoryID, trx.Amount, trx.Type, trx.Description, trx.Date, trx.ID, trx.UserID)
	if err != nil {
		return err
	}

	if trx.Type == "EXPENSE" {
		_, err = tx.Exec(ctx, "UPDATE wallets SET balance = balance - $1 WHERE id = $2", trx.Amount, trx.WalletID)
	} else {
		_, err = tx.Exec(ctx, "UPDATE wallets SET balance = balance + $1 WHERE id = $2", trx.Amount, trx.WalletID)
	}
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *transactionRepository) DeleteTransaction(ctx context.Context, id int64, userID int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	deleteSingleTrx := func(targetID int64) error {
		var walletID int64
		var amount float64
		var trxType string

		err := tx.QueryRow(ctx, "SELECT wallet_id, amount, transaction_type FROM transactions WHERE id = $1 AND user_id = $2", targetID, userID).Scan(&walletID, &amount, &trxType)
		if err != nil {
			return err
		}

		if trxType == "EXPENSE" {
			_, err = tx.Exec(ctx, "UPDATE wallets SET balance = balance + $1 WHERE id = $2", amount, walletID)
		} else {
			_, err = tx.Exec(ctx, "UPDATE wallets SET balance = balance - $1 WHERE id = $2", amount, walletID)
		}
		if err != nil {
			return err
		}

		_, err = tx.Exec(ctx, "DELETE FROM transactions WHERE id = $1", targetID)
		return err
	}

	var relatedID *int64
	_ = tx.QueryRow(ctx, "SELECT related_transaction_id FROM transactions WHERE id = $1 AND user_id = $2", id, userID).Scan(&relatedID)

	if err := deleteSingleTrx(id); err != nil {
		return err
	}

	if relatedID != nil {
		if err := deleteSingleTrx(*relatedID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *transactionRepository) UpdatePhoto(ctx context.Context, id int64, photoPath string) error {
	query := `UPDATE transactions SET photo_url = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, photoPath, id)
	return err
}
