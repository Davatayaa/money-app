package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"money-app-backend/internal/config"
	"money-app-backend/internal/handler"
	"money-app-backend/internal/routes"
	"money-app-backend/internal/scheduler"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func init() {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		log.Println("⚠️ Warning: Gagal load timezone Asia/Jakarta, menggunakan default system time.")
	} else {
		time.Local = loc
		log.Println("🕒 Timezone set to Asia/Jakarta")
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("ℹ️ Info: File .env tidak ditemukan, menggunakan System Environment Variables.")
	}

	config.ConnectDB()
	defer config.DB.Close()

	config.InitFirebase()
	handler.InitOAuth()

	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	allowedOrigins := []string{
		"http://localhost:5173",
		"http://localhost:4173",
		"http://localhost:3000",
	}

	prodFrontend := os.Getenv("FRONTEND_URL")
	if prodFrontend != "" {
		origins := strings.Split(prodFrontend, ",")
		for _, origin := range origins {
			allowedOrigins = append(allowedOrigins, strings.TrimSpace(origin))
		}
	}

	log.Println("🛡️ CORS Allowed Origins:", allowedOrigins)

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	storagePath := os.Getenv("STORAGE_PATH")
	if storagePath == "" {
		cwd, _ := os.Getwd()
		storagePath = filepath.Join(cwd, "uploads")
	}

	log.Printf("📂 Serving static files from: %s", storagePath)

	routes.InitRoutes(e)

	e.GET("/", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status":  "success",
			"message": "Money App Backend Running! 🚀",
		})
	})

	startAutoCleanup()
	scheduler.StartScheduler()
	go scheduler.StartDebtReminder()

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = ":8080"
	}

	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	log.Println("🚀 Server started on port", port)
	e.Logger.Fatal(e.Start(port))
}

func startAutoCleanup() {
	ticker := time.NewTicker(24 * time.Hour)

	go func() {
		for range ticker.C {
			log.Println("🧹 [AUTO CLEANUP] Memulai pembersihan harian...")
			ctx := context.Background()

			queryNotif := "DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days'"
			tagNotif, errNotif := config.DB.Exec(ctx, queryNotif)
			if errNotif != nil {
				log.Println("❌ Gagal cleanup notifikasi:", errNotif)
			} else {
				log.Printf("✅ %d Notifikasi usang dihapus.\n", tagNotif.RowsAffected())
			}

			queryLogs := "DELETE FROM login_logs WHERE login_at < NOW() - INTERVAL '30 days'"
			tagLogs, errLogs := config.DB.Exec(ctx, queryLogs)
			if errLogs != nil {
				log.Println("❌ Gagal cleanup login logs:", errLogs)
			} else {
				log.Printf("✅ %d Riwayat login usang dihapus.\n", tagLogs.RowsAffected())
			}

			log.Println("✨ [AUTO CLEANUP] Selesai.")
		}
	}()
}
