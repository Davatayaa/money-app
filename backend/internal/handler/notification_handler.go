package handler

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"

	"firebase.google.com/go/v4/messaging"

	"money-app-backend/internal/config"
	"money-app-backend/internal/utils"
)

type FCMRequest struct {
	FCMToken string `json:"fcm_token"`
}

type NotificationResponse struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Type      string    `json:"type"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

type SendNotifRequest struct {
	UserID    int    `json:"user_id"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	Type      string `json:"type"`
	TargetURL string `json:"target_url"`
}

type CreateScheduleRequest struct {
	Title         string `json:"title"`
	Body          string `json:"body"`
	Frequency     string `json:"frequency"`
	DayOfWeek     int    `json:"day_of_week"`
	DayOfMonth    int    `json:"day_of_month"`
	ExecutionTime string `json:"execution_time"`
}

type ScheduleResponse struct {
	ID            int    `json:"id"`
	Title         string `json:"title"`
	Body          string `json:"body"`
	Frequency     string `json:"frequency"`
	ExecutionTime string `json:"execution_time"`
	DayOfWeek     int    `json:"day_of_week"`
	DayOfMonth    int    `json:"day_of_month"`
}

func SendStatusChangeNotification(targetID int, newStatus string) {
	var title, body, notifType string
	if newStatus == "active" {
		title = "Akun Disetujui! 🎉"
		body = "Yayy!🔥, akun Anda telah disetujui oleh Admin."
		notifType = "success"
	} else if newStatus == "blocked" {
		title = "Akun Dibekukan ⚠️"
		body = "Maaf, akun Anda telah dinonaktifkan sementara."
		notifType = "error"
	} else {
		return
	}
	_ = utils.SendPushNotification(targetID, title, body, notifType, "/profile")
}

func UpdateFCMToken(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int(claims["user_id"].(float64))

	var req FCMRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data tidak valid"})
	}

	if req.FCMToken == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Token kosong"})
	}

	query := "UPDATE users SET fcm_token = $1 WHERE id = $2"
	_, err := config.DB.Exec(context.Background(), query, req.FCMToken, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal simpan token"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Token disimpan"})
}

func GetNotifications(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int(claims["user_id"].(float64))

	query := `SELECT id, title, body, type, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`
	rows, err := config.DB.Query(context.Background(), query, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal ambil data"})
	}
	defer rows.Close()

	var notifs []NotificationResponse
	for rows.Next() {
		var n NotificationResponse
		rows.Scan(&n.ID, &n.Title, &n.Body, &n.Type, &n.IsRead, &n.CreatedAt)
		notifs = append(notifs, n)
	}
	if notifs == nil {
		notifs = []NotificationResponse{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": notifs})
}

func MarkNotificationRead(c echo.Context) error {
	id := c.Param("id")
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int(claims["user_id"].(float64))

	query := "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2"
	tag, _ := config.DB.Exec(context.Background(), query, id, userID)
	if tag.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Notifikasi tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Read"})
}

func CleanupNotifications(c echo.Context) error {
	days := c.QueryParam("days")
	if days == "" {
		days = "30"
	}
	query := fmt.Sprintf("DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '%s days'", days)
	config.DB.Exec(context.Background(), query)
	return c.JSON(http.StatusOK, map[string]string{"message": "Cleanup success"})
}

func SendNotification(c echo.Context) error {
	var req SendNotifRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data JSON tidak valid"})
	}

	if req.Title == "" || req.Body == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Title dan Body wajib diisi"})
	}

	if req.Type == "" {
		req.Type = "info"
	}
	if req.TargetURL == "" {
		req.TargetURL = "/"
	}

	if req.UserID == 0 {
		queryInsert := `
			INSERT INTO notifications (user_id, title, body, type, created_at, is_read)
			SELECT id, $1, $2, $3, NOW(), FALSE FROM users WHERE status != 'blocked'
		`
		_, _ = config.DB.Exec(context.Background(), queryInsert, req.Title, req.Body, req.Type)

		go func() {
			if config.FCMClient == nil {
				return
			}

			rows, _ := config.DB.Query(context.Background(), "SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL AND fcm_token != ''")
			defer rows.Close()

			for rows.Next() {
				var token string
				if err := rows.Scan(&token); err == nil {
					msg := &messaging.Message{
						Token: token,
						Notification: &messaging.Notification{
							Title: req.Title,
							Body:  req.Body,
						},
						Data: map[string]string{
							"url": req.TargetURL,
						},
						Android: &messaging.AndroidConfig{
							Priority:     "high",
							Notification: &messaging.AndroidNotification{Sound: "default"},
						},
					}
					config.FCMClient.Send(context.Background(), msg)
				}
			}
		}()

		return c.JSON(http.StatusOK, map[string]string{"message": "Broadcast berhasil dikirim"})
	}

	query := `INSERT INTO notifications (user_id, title, body, type, created_at, is_read) VALUES ($1, $2, $3, $4, NOW(), FALSE)`
	_, err := config.DB.Exec(context.Background(), query, req.UserID, req.Title, req.Body, req.Type)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal simpan DB"})
	}

	go func() {
		if config.FCMClient == nil {
			return
		}

		var fcmToken string
		err := config.DB.QueryRow(context.Background(), "SELECT fcm_token FROM users WHERE id = $1", req.UserID).Scan(&fcmToken)

		if err == nil && fcmToken != "" {
			msg := &messaging.Message{
				Token: fcmToken,
				Notification: &messaging.Notification{
					Title: req.Title,
					Body:  req.Body,
				},
				Data: map[string]string{
					"url": req.TargetURL,
				},
				Android: &messaging.AndroidConfig{
					Priority:     "high",
					Notification: &messaging.AndroidNotification{Sound: "default"},
				},
			}
			config.FCMClient.Send(context.Background(), msg)
		}
	}()

	return c.JSON(http.StatusOK, map[string]string{"message": "Notifikasi personal berhasil"})
}

func CreateSchedule(c echo.Context) error {
	var req CreateScheduleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data invalid"})
	}
	query := `INSERT INTO notification_schedules (title, body, frequency, day_of_week, day_of_month, execution_time) VALUES ($1, $2, $3, $4, $5, $6)`
	config.DB.Exec(context.Background(), query, req.Title, req.Body, req.Frequency, req.DayOfWeek, req.DayOfMonth, req.ExecutionTime)
	return c.JSON(http.StatusOK, map[string]string{"message": "Jadwal dibuat"})
}

func GetSchedules(c echo.Context) error {
	query := `SELECT id, title, body, frequency, execution_time, day_of_week, day_of_month FROM notification_schedules WHERE is_active = true ORDER BY id DESC`
	rows, _ := config.DB.Query(context.Background(), query)
	defer rows.Close()
	var schedules []ScheduleResponse
	for rows.Next() {
		var s ScheduleResponse
		rows.Scan(&s.ID, &s.Title, &s.Body, &s.Frequency, &s.ExecutionTime, &s.DayOfWeek, &s.DayOfMonth)
		schedules = append(schedules, s)
	}
	if schedules == nil {
		schedules = []ScheduleResponse{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": schedules})
}

func DeleteSchedule(c echo.Context) error {
	id := c.Param("id")
	config.DB.Exec(context.Background(), "DELETE FROM notification_schedules WHERE id = $1", id)
	return c.JSON(http.StatusOK, map[string]string{"message": "Dihapus"})
}

func UpdateSchedule(c echo.Context) error {
	id := c.Param("id")
	var req CreateScheduleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid"})
	}
	query := `UPDATE notification_schedules SET title=$1, body=$2, frequency=$3, day_of_week=$4, day_of_month=$5, execution_time=$6 WHERE id=$7`
	tag, _ := config.DB.Exec(context.Background(), query, req.Title, req.Body, req.Frequency, req.DayOfWeek, req.DayOfMonth, req.ExecutionTime, id)
	if tag.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Jadwal tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Diupdate"})
}
