package models

import "time"

type Debt struct {
	ID                 int       `json:"id"`
	UserID             int       `json:"user_id"`
	PersonName         string    `json:"person_name"`
	Amount             float64   `json:"amount"`
	Type               string    `json:"type"`
	Status             string    `json:"status"`
	DueDate            time.Time `json:"due_date"`
	Description        string    `json:"description"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
	ReminderDaysBefore int       `json:"reminder_days_before"`
	ReminderTime       string    `json:"reminder_time"`
}
