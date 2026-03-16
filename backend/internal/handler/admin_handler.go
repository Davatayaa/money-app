package handler

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"money-app-backend/internal/config"
	"money-app-backend/pkg/response"

	"github.com/labstack/echo/v4"
)

type AdminHandler struct{}

func NewAdminHandler() *AdminHandler {
	return &AdminHandler{}
}

type AdminUserResponse struct {
	ID          int        `json:"id"`
	Name        string     `json:"name"`
	Email       string     `json:"email"`
	AvatarURL   string     `json:"avatar_url"`
	Role        string     `json:"role"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	LastLoginAt *time.Time `json:"last_login_at"`
}

type UpdateStatusRequest struct {
	Status string `json:"status"`
}

type LoginLogResponse struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	LoginAt   time.Time `json:"login_at"`
}

func (h *AdminHandler) GetAllUsers(c echo.Context) error {
	query := `
        SELECT id, name, email, avatar_url, role, status, created_at, last_login_at 
        FROM users 
        ORDER BY created_at DESC
    `
	rows, err := config.DB.Query(context.Background(), query)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil data user: "+err.Error())
	}
	defer rows.Close()

	var users []AdminUserResponse
	for rows.Next() {
		var u AdminUserResponse
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.AvatarURL, &u.Role, &u.Status, &u.CreatedAt, &u.LastLoginAt); err != nil {
			return response.Error(c, http.StatusInternalServerError, "Error scanning user: "+err.Error())
		}
		users = append(users, u)
	}

	if users == nil {
		users = []AdminUserResponse{}
	}

	return response.Success(c, http.StatusOK, "List all users", users)
}

func (h *AdminHandler) UpdateUserStatus(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID user tidak valid")
	}

	var input UpdateStatusRequest
	if err := c.Bind(&input); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format data salah")
	}

	if input.Status != "active" && input.Status != "blocked" && input.Status != "pending" {
		return response.Error(c, http.StatusBadRequest, "Status harus active, blocked, atau pending")
	}

	query := "UPDATE users SET status = $1 WHERE id = $2"
	tag, err := config.DB.Exec(context.Background(), query, input.Status, id)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal update status: "+err.Error())
	}

	if tag.RowsAffected() == 0 {
		return response.Error(c, http.StatusNotFound, "User tidak ditemukan")
	}

	go SendStatusChangeNotification(id, input.Status)

	return response.Success(c, http.StatusOK, "Status user berhasil diubah menjadi "+input.Status, nil)
}

func (h *AdminHandler) DeleteUser(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID tidak valid")
	}

	query := "DELETE FROM users WHERE id = $1"
	tag, err := config.DB.Exec(context.Background(), query, id)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menghapus user: "+err.Error())
	}

	if tag.RowsAffected() == 0 {
		return response.Error(c, http.StatusNotFound, "User tidak ditemukan")
	}

	return response.Success(c, http.StatusOK, "User berhasil dihapus permanen", nil)
}

func (h *AdminHandler) GetLoginLogs(c echo.Context) error {
	query := `
        SELECT l.id, l.user_id, u.name, u.email, l.ip_address, l.user_agent, l.login_at
        FROM login_logs l
        JOIN users u ON l.user_id = u.id
        ORDER BY l.login_at DESC
        LIMIT 100
    `
	rows, err := config.DB.Query(context.Background(), query)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil logs: "+err.Error())
	}
	defer rows.Close()

	var logs []LoginLogResponse
	for rows.Next() {
		var l LoginLogResponse
		if err := rows.Scan(&l.ID, &l.UserID, &l.Name, &l.Email, &l.IPAddress, &l.UserAgent, &l.LoginAt); err != nil {
			return response.Error(c, http.StatusInternalServerError, "Error scanning logs: "+err.Error())
		}
		logs = append(logs, l)
	}

	if logs == nil {
		logs = []LoginLogResponse{}
	}

	return response.Success(c, http.StatusOK, "Login history (Last 100)", logs)
}
