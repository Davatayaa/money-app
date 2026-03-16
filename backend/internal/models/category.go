package models

import "time"

type Category struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Name      string    `json:"name" validate:"required"`
	Type      string    `json:"type" validate:"required,oneof=EXPENSE INCOME"`
	Icon      string    `json:"icon"`
	Color     string    `json:"color"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}
