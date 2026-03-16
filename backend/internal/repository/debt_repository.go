package repository

import (
	"context"
	"money-app-backend/internal/models"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DebtRepository interface {
	Create(ctx context.Context, debt *models.Debt) error
	GetAll(ctx context.Context, userID int64) ([]models.Debt, error)
	MarkPaid(ctx context.Context, id int64, userID int64) error
	Delete(ctx context.Context, id int64, userID int64) error
	Update(ctx context.Context, d *models.Debt) error
}

type debtRepository struct {
	db *pgxpool.Pool
}

func NewDebtRepository(db *pgxpool.Pool) DebtRepository {
	return &debtRepository{db: db}
}

func (r *debtRepository) Create(ctx context.Context, debt *models.Debt) error {
	query := `
		INSERT INTO debts (
			user_id, person_name, amount, type, due_date, description, 
			status, created_at, reminder_days_before, reminder_time
		) 
		VALUES ($1, $2, $3, $4, $5, $6, 'BELUM_LUNAS', NOW(), $7, $8) 
		RETURNING id
	`

	var dateVal interface{}
	if debt.DueDate.IsZero() {
		dateVal = nil
	} else {
		dateVal = debt.DueDate
	}

	err := r.db.QueryRow(ctx, query,
		debt.UserID,
		debt.PersonName,
		debt.Amount,
		debt.Type,
		dateVal,
		debt.Description,
		debt.ReminderDaysBefore,
		debt.ReminderTime,
	).Scan(&debt.ID)

	return err
}

func (r *debtRepository) GetAll(ctx context.Context, userID int64) ([]models.Debt, error) {
	query := `
		SELECT 
			id, person_name, amount, type, status, due_date, 
			COALESCE(description, ''), reminder_days_before, reminder_time
		FROM debts 
		WHERE user_id = $1 
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var debts []models.Debt
	for rows.Next() {
		var d models.Debt
		var dueDate *time.Time

		err := rows.Scan(
			&d.ID,
			&d.PersonName,
			&d.Amount,
			&d.Type,
			&d.Status,
			&dueDate,
			&d.Description,
			&d.ReminderDaysBefore,
			&d.ReminderTime,
		)
		if err != nil {
			return nil, err
		}

		if dueDate != nil {
			d.DueDate = *dueDate
		}
		debts = append(debts, d)
	}
	return debts, nil
}

func (r *debtRepository) Update(ctx context.Context, d *models.Debt) error {
	query := `
		UPDATE debts 
		SET person_name=$1, amount=$2, type=$3, due_date=$4, description=$5, 
			reminder_days_before=$6, reminder_time=$7, updated_at=NOW()
		WHERE id=$8 AND user_id=$9
	`

	var dateVal interface{}
	if d.DueDate.IsZero() {
		dateVal = nil
	} else {
		dateVal = d.DueDate
	}

	_, err := r.db.Exec(ctx, query,
		d.PersonName,
		d.Amount,
		d.Type,
		dateVal,
		d.Description,
		d.ReminderDaysBefore,
		d.ReminderTime,
		d.ID,
		d.UserID,
	)

	return err
}

func (r *debtRepository) MarkPaid(ctx context.Context, id int64, userID int64) error {
	query := `UPDATE debts SET status = 'LUNAS', updated_at = NOW() WHERE id = $1 AND user_id = $2`
	_, err := r.db.Exec(ctx, query, id, userID)
	return err
}

func (r *debtRepository) Delete(ctx context.Context, id int64, userID int64) error {
	query := `DELETE FROM debts WHERE id = $1 AND user_id = $2`
	_, err := r.db.Exec(ctx, query, id, userID)
	return err
}
