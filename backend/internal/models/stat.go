package models

type CategoryStat struct {
	CategoryName string  `json:"category_name"`
	Type         string  `json:"type"`
	Color        string  `json:"color"`
	Icon         string  `json:"icon"`
	TotalAmount  float64 `json:"total_amount"`
	Percentage   float64 `json:"percentage,omitempty"`
}

type DashboardResponse struct {
	TotalIncome  float64        `json:"total_income"`
	TotalExpense float64        `json:"total_expense"`
	Stats        []CategoryStat `json:"stats"`
}
