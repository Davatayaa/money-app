package repository

import (
	"context"
	"errors"
	"fmt"
	"money-app-backend/internal/models"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WalletRepository interface {
	CreateWallet(ctx context.Context, wallet *models.Wallet) error
	GetWalletsByUserID(ctx context.Context, userID int64, month int, year int) ([]models.Wallet, error)
	GetWalletByID(ctx context.Context, id int64) (*models.Wallet, error)
	UpdateWallet(ctx context.Context, wallet *models.Wallet, adjustmentTrx *models.Transaction) error
	DeleteWallet(ctx context.Context, id int64, userID int64) error
	GetOrCreateAdjustmentCategory(ctx context.Context, userID int64) (int64, error)
}

type walletRepository struct {
	db *pgxpool.Pool
}

func NewWalletRepository(db *pgxpool.Pool) WalletRepository {
	return &walletRepository{db: db}
}

func (r *walletRepository) CreateWallet(ctx context.Context, wallet *models.Wallet) error {
	query := `
		INSERT INTO wallets (user_id, name, type, currency, balance, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`
	wallet.CreatedAt = time.Now()

	err := r.db.QueryRow(ctx, query,
		wallet.UserID,
		wallet.Name,
		wallet.Type,
		wallet.Currency,
		wallet.Balance,
		wallet.CreatedAt,
	).Scan(&wallet.ID)

	return err
}

func (r *walletRepository) GetWalletsByUserID(ctx context.Context, userID int64, month int, year int) ([]models.Wallet, error) {
	query := `
        SELECT 
            w.id, w.user_id, w.name, w.type, w.currency, w.balance, w.created_at,
            COALESCE(
                SUM(
                    CASE 
                        WHEN t.transaction_type = 'INCOME' THEN t.amount 
                        WHEN t.transaction_type = 'EXPENSE' THEN -t.amount 
                        ELSE 0 
                    END
                ), 0
            ) AS monthly_flow
        FROM wallets w
        LEFT JOIN transactions t 
            ON w.id = t.wallet_id 
            AND CAST(EXTRACT(MONTH FROM t.transaction_date) AS INT) = $2 
            AND CAST(EXTRACT(YEAR FROM t.transaction_date) AS INT) = $3
        WHERE w.user_id = $1
        GROUP BY w.id
        ORDER BY w.created_at ASC
    `

	rows, err := r.db.Query(ctx, query, userID, month, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var wallets []models.Wallet
	for rows.Next() {
		var w models.Wallet
		err := rows.Scan(&w.ID, &w.UserID, &w.Name, &w.Type, &w.Currency, &w.Balance, &w.CreatedAt, &w.MonthlyFlow)
		if err != nil {
			return nil, err
		}
		wallets = append(wallets, w)
	}

	if wallets == nil {
		wallets = []models.Wallet{}
	}

	return wallets, nil
}

func (r *walletRepository) UpdateWallet(ctx context.Context, wallet *models.Wallet, adjustmentTrx *models.Transaction) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	queryUpdate := `
		UPDATE wallets 
		SET name = $1, type = $2, balance = $3
		WHERE id = $4 AND user_id = $5
	`
	tag, err := tx.Exec(ctx, queryUpdate, wallet.Name, wallet.Type, wallet.Balance, wallet.ID, wallet.UserID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return models.ErrWalletNotFound
	}

	if adjustmentTrx != nil {
		queryInsertTrx := `
			INSERT INTO transactions (user_id, wallet_id, category_id, amount, transaction_type, transaction_date, description, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`
		_, err = tx.Exec(ctx, queryInsertTrx,
			adjustmentTrx.UserID,
			adjustmentTrx.WalletID,
			adjustmentTrx.CategoryID,
			adjustmentTrx.Amount,
			adjustmentTrx.Type,
			adjustmentTrx.Date,
			adjustmentTrx.Description,
			time.Now(),
		)
		if err != nil {
			return fmt.Errorf("gagal mencatat transaksi penyesuaian: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func (r *walletRepository) DeleteWallet(ctx context.Context, id int64, userID int64) error {
	query := `DELETE FROM wallets WHERE id = $1 AND user_id = $2`
	commandTag, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return nil
	}
	return nil
}

func (r *walletRepository) GetWalletByID(ctx context.Context, id int64) (*models.Wallet, error) {
	query := `SELECT id, user_id, name, type, currency, balance FROM wallets WHERE id = $1`
	var w models.Wallet
	err := r.db.QueryRow(ctx, query, id).Scan(&w.ID, &w.UserID, &w.Name, &w.Type, &w.Currency, &w.Balance)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrWalletNotFound
		}
		return nil, err
	}
	return &w, nil
}

func (r *walletRepository) GetOrCreateAdjustmentCategory(ctx context.Context, userID int64) (int64, error) {
	var id int64
	queryCheck := `
		SELECT id FROM categories 
		WHERE user_id = $1 
		AND (name ILIKE 'Balance Adjustment' OR name ILIKE 'Koreksi Saldo') 
		LIMIT 1
	`

	err := r.db.QueryRow(ctx, queryCheck, userID).Scan(&id)
	if err == nil {
		return id, nil
	}

	queryCreate := `
		INSERT INTO categories (user_id, name, type, icon, color)
		VALUES ($1, 'Balance Adjustment', 'EXPENSE', 'Scale', '#94A3B8')
		RETURNING id
	`
	err = r.db.QueryRow(ctx, queryCreate, userID).Scan(&id)
	if err != nil {
		return 0, err
	}

	return id, nil
}
