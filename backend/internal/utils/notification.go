package utils

import (
	"context"
	"log"
	"money-app-backend/internal/config"
	"os"
	"strings"

	"firebase.google.com/go/v4/messaging"
)

func SendPushNotification(userID int, title string, body string, notifType string, targetPath string) error {
	if notifType == "" {
		notifType = "info"
	}
	if targetPath == "" {
		targetPath = "/"
	}

	queryInsert := "INSERT INTO notifications (user_id, title, body, type, is_read, created_at) VALUES ($1, $2, $3, $4, FALSE, NOW())"
	_, errDb := config.DB.Exec(context.Background(), queryInsert, userID, title, body, notifType)

	if errDb != nil {
		log.Println("❌ Gagal simpan notifikasi ke DB:", errDb)
	} else {
		log.Printf("✅ Notifikasi disimpan di DB untuk User ID: %d", userID)
	}

	var fcmToken string
	queryToken := "SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL AND fcm_token != ''"
	err := config.DB.QueryRow(context.Background(), queryToken, userID).Scan(&fcmToken)

	if err != nil {
		return nil
	}

	if config.FCMClient == nil {
		log.Println("⚠️ FCM Client belum diinisialisasi")
		return nil
	}

	appURL := os.Getenv("FRONTEND_URL")
	if appURL == "" {
		appURL = "https://google.com"
	}

	fullLink := appURL
	if targetPath != "/" {
		if !strings.HasPrefix(targetPath, "/") {
			targetPath = "/" + targetPath
		}
		fullLink = appURL + targetPath
	}

	message := &messaging.Message{
		Token: fcmToken,

		Notification: &messaging.Notification{
			Title: title,
			Body:  body,
		},

		Data: map[string]string{
			"type": notifType,
			"url":  targetPath,
		},

		Webpush: &messaging.WebpushConfig{
			Headers: map[string]string{
				"Urgency": "high",
			},
			Notification: &messaging.WebpushNotification{
				Icon: "/vite.svg",
				Actions: []*messaging.WebpushNotificationAction{
					{Title: "Buka", Action: "open_app"},
				},
			},
			FCMOptions: &messaging.WebpushFCMOptions{
				Link: fullLink,
			},
		},

		Android: &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				Sound:                 "default",
				Priority:              messaging.PriorityHigh,
				DefaultSound:          true,
				DefaultVibrateTimings: true,
			},
		},
	}

	_, errFcm := config.FCMClient.Send(context.Background(), message)
	if errFcm != nil {
		if errFcm.Error() == "registration-token-not-registered" {
			config.DB.Exec(context.Background(), "UPDATE users SET fcm_token = NULL WHERE id = $1", userID)
			log.Printf("⚠️ Token invalid untuk user %d, dihapus dari DB.", userID)
		} else {
			log.Println("❌ Gagal kirim ke HP:", errFcm)
		}
		return errFcm
	}

	log.Println("🚀 Sukses kirim Push Notification ke HP")
	return nil
}
