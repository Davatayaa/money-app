package scheduler

import (
	"context"
	"log"
	"time"

	"money-app-backend/internal/config"

	"firebase.google.com/go/v4/messaging"
)

type Schedule struct {
	ID            int
	Title         string
	Body          string
	Frequency     string
	DayOfWeek     int
	DayOfMonth    int
	ExecutionTime string
}

func StartScheduler() {
	ticker := time.NewTicker(1 * time.Minute)

	go func() {
		for {
			select {
			case t := <-ticker.C:
				checkAndSendNotifications(t)
			}
		}
	}()

	log.Println("⏰ Scheduler Service Berjalan...")
}

func checkAndSendNotifications(t time.Time) {
	currentTime := t.Format("15:04")
	currentDayWeek := int(t.Weekday())
	currentDayMonth := t.Day()

	query := `
		SELECT id, title, body, frequency, day_of_week, day_of_month 
		FROM notification_schedules 
		WHERE is_active = true AND execution_time = $1
	`
	rows, err := config.DB.Query(context.Background(), query, currentTime)
	if err != nil {
		log.Println("❌ Scheduler Error Query:", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var s Schedule
		if err := rows.Scan(&s.ID, &s.Title, &s.Body, &s.Frequency, &s.DayOfWeek, &s.DayOfMonth); err != nil {
			continue
		}

		shouldSend := false
		switch s.Frequency {
		case "DAILY":
			shouldSend = true
		case "WEEKLY":
			if s.DayOfWeek == currentDayWeek {
				shouldSend = true
			}
		case "MONTHLY":
			if s.DayOfMonth == currentDayMonth {
				shouldSend = true
			}
		}

		if shouldSend {
			go broadcastNotification(s)
		}
	}
}

func broadcastNotification(s Schedule) {
	log.Printf("🚀 Mengeksekusi Jadwal: %s [%s]", s.Title, s.Frequency)
	ctx := context.Background()

	queryInsert := `
		INSERT INTO notifications (user_id, title, body, type, created_at, is_read)
		SELECT id, $1, $2, 'info', NOW(), FALSE FROM users WHERE status = 'active'
	`
	_, err := config.DB.Exec(ctx, queryInsert, s.Title, s.Body)
	if err != nil {
		log.Println("❌ Gagal simpan notif scheduler ke DB:", err)
	}

	if config.FCMClient == nil {
		log.Println("⚠️ FCM Client tidak terinisialisasi")
		return
	}

	rows, err := config.DB.Query(ctx, "SELECT fcm_token FROM users WHERE status = 'active' AND fcm_token IS NOT NULL AND fcm_token != ''")
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err == nil {
			msg := &messaging.Message{
				Token: token,
				Notification: &messaging.Notification{
					Title: s.Title,
					Body:  s.Body,
				},
				Data: map[string]string{
					"url": "/",
				},
				Android: &messaging.AndroidConfig{
					Priority: "high",
					Notification: &messaging.AndroidNotification{
						Sound: "default",
					},
				},
				APNS: &messaging.APNSConfig{
					Headers: map[string]string{
						"apns-priority": "10",
					},
					Payload: &messaging.APNSPayload{
						Aps: &messaging.Aps{
							Sound:            "default",
							ContentAvailable: true,
						},
					},
				},
			}
			config.FCMClient.Send(ctx, msg)
		}
	}
	log.Printf("✅ Selesai mengirim broadcast jadwal: %s", s.Title)
}
