package repository

import (
	"context"
	"errors"
	"money-app-backend/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CategoryRepository interface {
	GetCategories(ctx context.Context, userID int64) ([]models.Category, error)
	CreateCategory(ctx context.Context, category *models.Category) error
	UpdateCategory(ctx context.Context, category *models.Category) error
	DeleteCategory(ctx context.Context, id int64, userID int64) error
}

type categoryRepository struct {
	db *pgxpool.Pool
}

func NewCategoryRepository(db *pgxpool.Pool) CategoryRepository {
	return &categoryRepository{db: db}
}

func (r *categoryRepository) GetCategories(ctx context.Context, userID int64) ([]models.Category, error) {
	query := `SELECT id, user_id, name, type, icon, color, is_active FROM categories WHERE user_id = $1 AND is_active = true ORDER BY name ASC`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.UserID, &c.Name, &c.Type, &c.Icon, &c.Color, &c.IsActive); err != nil {
			return nil, err
		}
		categories = append(categories, c)
	}
	return categories, nil
}

func (r *categoryRepository) CreateCategory(ctx context.Context, c *models.Category) error {
	query := `INSERT INTO categories (user_id, name, type, icon, color, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id`

	return r.db.QueryRow(ctx, query, c.UserID, c.Name, c.Type, c.Icon, c.Color).Scan(&c.ID)
}

func (r *categoryRepository) UpdateCategory(ctx context.Context, c *models.Category) error {
	query := `UPDATE categories SET name = $1, type = $2, color = $3 WHERE id = $4 AND user_id = $5`

	ct, err := r.db.Exec(ctx, query, c.Name, c.Type, c.Color, c.ID, c.UserID)
	if err != nil {
		return err
	}

	if ct.RowsAffected() == 0 {
		return errors.New("category not found or unauthorized")
	}

	return nil
}

func (r *categoryRepository) DeleteCategory(ctx context.Context, id int64, userID int64) error {
	query := `UPDATE categories SET is_active = false WHERE id = $1 AND user_id = $2`

	ct, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return err
	}

	if ct.RowsAffected() == 0 {
		return errors.New("category not found or unauthorized")
	}

	return nil
}
