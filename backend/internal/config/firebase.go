package config

import (
	"context"
	"fmt"
	"os"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

var FCMClient *messaging.Client

func InitFirebase() {
	serviceAccountKeyFilePath := "service-account.json"

	if _, err := os.Stat(serviceAccountKeyFilePath); os.IsNotExist(err) {
		fmt.Println("⚠️ Warning: File service-account.json TIDAK DITEMUKAN. Fitur notifikasi dimatikan.")
		return
	}

	opt := option.WithCredentialsFile(serviceAccountKeyFilePath)

	projectID := os.Getenv("FIREBASE_PROJECT_ID")
	if projectID == "" {
		fmt.Println("⚠️ Warning: FIREBASE_PROJECT_ID tidak ditemukan di .env")
	}

	conf := &firebase.Config{ProjectID: projectID}

	app, err := firebase.NewApp(context.Background(), conf, opt)
	if err != nil {
		fmt.Printf("⚠️ Gagal init Firebase App: %v\n", err)
		return
	}

	client, err := app.Messaging(context.Background())
	if err != nil {
		fmt.Printf("⚠️ Gagal init FCM Client: %v\n", err)
		return
	}

	FCMClient = client
	fmt.Println("✅ Firebase Cloud Messaging Siap!")
}
