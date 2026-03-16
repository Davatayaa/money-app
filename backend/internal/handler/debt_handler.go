package handler

import (
	"money-app-backend/internal/models"
	"money-app-backend/internal/repository"
	"net/http"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type DebtHandler struct {
	repo repository.DebtRepository
}

func NewDebtHandler(repo repository.DebtRepository) *DebtHandler {
	return &DebtHandler{repo: repo}
}

func (h *DebtHandler) CreateDebt(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int(claims["user_id"].(float64))

	var input struct {
		PersonName   string  `json:"person_name"`
		Amount       float64 `json:"amount"`
		Type         string  `json:"type"`
		DueDate      string  `json:"due_date"`
		Description  string  `json:"description"`
		ReminderDays int     `json:"reminder_days_before"`
		ReminderTime string  `json:"reminder_time"`
	}

	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if input.PersonName == "" || input.Amount <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama dan Jumlah wajib diisi"})
	}

	if input.ReminderTime == "" {
		input.ReminderTime = "09:00"
	}

	debt := models.Debt{
		UserID:             userID,
		PersonName:         input.PersonName,
		Amount:             input.Amount,
		Type:               input.Type,
		Description:        input.Description,
		ReminderDaysBefore: input.ReminderDays,
		ReminderTime:       input.ReminderTime,
		Status:             "BELUM_LUNAS",
		CreatedAt:          time.Now(),
	}

	if input.DueDate != "" {
		parsedDate, err := time.Parse("2006-01-02", input.DueDate)
		if err == nil {
			debt.DueDate = parsedDate
		}
	}

	if err := h.repo.Create(c.Request().Context(), &debt); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan data"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Berhasil disimpan",
		"data":    debt,
	})
}

func (h *DebtHandler) GetDebts(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	userID := int64(userToken.Claims.(jwt.MapClaims)["user_id"].(float64))

	debts, err := h.repo.GetAll(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal mengambil data"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": debts})
}

func (h *DebtHandler) UpdateDebt(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int(claims["user_id"].(float64))

	id, _ := strconv.Atoi(c.Param("id"))

	var input struct {
		PersonName   string  `json:"person_name"`
		Amount       float64 `json:"amount"`
		Type         string  `json:"type"`
		DueDate      string  `json:"due_date"`
		Description  string  `json:"description"`
		ReminderDays int     `json:"reminder_days_before"`
		ReminderTime string  `json:"reminder_time"`
	}

	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if input.PersonName == "" || input.Amount <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama dan Jumlah wajib diisi"})
	}

	if input.ReminderTime == "" {
		input.ReminderTime = "09:00"
	}

	debt := models.Debt{
		ID:                 id,
		UserID:             userID,
		PersonName:         input.PersonName,
		Amount:             input.Amount,
		Type:               input.Type,
		Description:        input.Description,
		ReminderDaysBefore: input.ReminderDays,
		ReminderTime:       input.ReminderTime,
	}

	if input.DueDate != "" {
		parsedDate, err := time.Parse("2006-01-02", input.DueDate)
		if err == nil {
			debt.DueDate = parsedDate
		}
	}

	if err := h.repo.Update(c.Request().Context(), &debt); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal mengupdate data: " + err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Berhasil diupdate",
		"data":    debt,
	})
}

func (h *DebtHandler) MarkPaid(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	userID := int64(userToken.Claims.(jwt.MapClaims)["user_id"].(float64))
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	if err := h.repo.MarkPaid(c.Request().Context(), id, userID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal update status"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Status updated"})
}

func (h *DebtHandler) DeleteDebt(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	userID := int64(userToken.Claims.(jwt.MapClaims)["user_id"].(float64))
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	if err := h.repo.Delete(c.Request().Context(), id, userID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Deleted"})
}
