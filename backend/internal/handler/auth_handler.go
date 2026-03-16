package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"money-app-backend/internal/config"
	"money-app-backend/internal/utils"
)

var googleOauthConfig *oauth2.Config

func InitOAuth() {
	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = "http://localhost:8080"
	}

	redirectURL := backendURL + "/auth/google/callback"
	if manualRedirect := os.Getenv("GOOGLE_REDIRECT_URL"); manualRedirect != "" {
		redirectURL = manualRedirect
	}

	log.Println("🔑 OAuth Redirect URL set to:", redirectURL)

	googleOauthConfig = &oauth2.Config{
		RedirectURL:  redirectURL,
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
		Endpoint:     google.Endpoint,
	}
}

func sanitizeString(str string) string {
	reg, _ := regexp.Compile("[^a-zA-Z0-9]+")
	return strings.ToLower(reg.ReplaceAllString(str, ""))
}

func GoogleLogin(c echo.Context) error {
	url := googleOauthConfig.AuthCodeURL(
		"random-state-string",
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("prompt", "select_account"),
	)

	return c.Redirect(http.StatusTemporaryRedirect, url)
}

func GoogleCallback(c echo.Context) error {
	ctx := c.Request().Context()

	frontendBaseURL := os.Getenv("FRONTEND_URL")
	if frontendBaseURL == "" {
		frontendBaseURL = "http://localhost:5173"
	}

	code := c.QueryParam("code")
	if code == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Code not found"})
	}

	token, err := googleOauthConfig.Exchange(ctx, code)
	if err != nil {
		log.Println("OAuth Exchange Error:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to exchange token"})
	}

	resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + token.AccessToken)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to get user info"})
	}
	defer resp.Body.Close()

	var userInfo struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to decode user info"})
	}

	var userID int
	var role string
	var status string

	queryCheck := "SELECT id, role, status FROM users WHERE email = $1"
	err = config.DB.QueryRow(ctx, queryCheck, userInfo.Email).Scan(&userID, &role, &status)

	if err == nil {
		if role != "admin" {
			if status == "pending" {
				return c.Redirect(http.StatusTemporaryRedirect, frontendBaseURL+"/login?error=pending")
			}
			if status == "blocked" {
				return c.Redirect(http.StatusTemporaryRedirect, frontendBaseURL+"/login?error=blocked")
			}
		}
	} else {
		log.Println("🆕 User baru mendaftar:", userInfo.Email)

		var firstName, lastName string
		if userInfo.Name == "" {
			parts := strings.Split(userInfo.Email, "@")
			firstName = sanitizeString(parts[0])
		} else {
			names := strings.Fields(userInfo.Name)
			firstName = sanitizeString(names[0])
			if len(names) > 1 {
				lastName = sanitizeString(names[1])
			}
		}

		var finalUsername string
		attempt := 0
		for {
			candidate := ""
			if attempt == 0 {
				candidate = firstName
			} else if attempt == 1 && lastName != "" {
				candidate = firstName + lastName
			} else if attempt == 2 && lastName != "" {
				candidate = firstName + "_" + lastName
			} else {
				rand.Seed(time.Now().UnixNano())
				randNum := rand.Intn(1000) + (attempt * 100)
				candidate = fmt.Sprintf("%s%d", firstName, randNum)
			}

			var count int
			config.DB.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE username = $1", candidate).Scan(&count)
			if count == 0 {
				finalUsername = candidate
				break
			}
			attempt++
			if attempt > 10 {
				finalUsername = fmt.Sprintf("%s%d", firstName, time.Now().Unix())
				break
			}
		}

		if userInfo.Picture == "" {
			userInfo.Picture = "https://ui-avatars.com/api/?name=" + url.QueryEscape(userInfo.Name) + "&background=random"
		}

		queryInsert := `
			INSERT INTO users (name, username, email, google_id, avatar_url, created_at, role, status) 
			VALUES ($1, $2, $3, $4, $5, NOW(), 'user', 'pending') 
			RETURNING id
		`
		err = config.DB.QueryRow(ctx, queryInsert, userInfo.Name, finalUsername, userInfo.Email, userInfo.ID, userInfo.Picture).Scan(&userID)

		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal registrasi: " + err.Error()})
		}

		go func() {
			bgCtx := context.Background()

			var adminID int
			errFindAdmin := config.DB.QueryRow(bgCtx, "SELECT id FROM users WHERE role = 'admin' LIMIT 1").Scan(&adminID)

			if errFindAdmin != nil {
				log.Println("⚠️ Gagal mencari ID Admin untuk notifikasi:", errFindAdmin)
				return
			}

			title := "👤 Pendaftaran User Baru"
			body := fmt.Sprintf("User baru '%s' (%s) menunggu persetujuan.", userInfo.Name, userInfo.Email)

			errNotif := utils.SendPushNotification(adminID, title, body, "admin_alert", "/admin/users")

			if errNotif != nil {
				log.Println("Gagal kirim notif ke admin:", errNotif)
			} else {
				log.Printf("✅ Notifikasi registrasi dikirim ke Admin ID: %d", adminID)
			}
		}()

		return c.Redirect(http.StatusTemporaryRedirect, frontendBaseURL+"/login?error=pending")
	}

	ipAddress := c.RealIP()
	userAgent := c.Request().UserAgent()

	go func() {
		bgCtx := context.Background()
		_, errLog := config.DB.Exec(bgCtx,
			"INSERT INTO login_logs (user_id, ip_address, user_agent) VALUES ($1, $2, $3)",
			userID, ipAddress, userAgent)
		if errLog != nil {
			log.Println("Gagal mencatat login log:", errLog)
		}

		_, errUpdate := config.DB.Exec(bgCtx,
			"UPDATE users SET last_login_at = NOW() WHERE id = $1",
			userID)
		if errUpdate != nil {
			log.Println("Gagal update last_login_at:", errUpdate)
		}
	}()

	jwtSecret := []byte(os.Getenv("JWT_SECRET"))
	claims := jwt.MapClaims{
		"user_id": userID,
		"email":   userInfo.Email,
		"role":    role,
		"exp":     time.Now().Add(time.Hour * 8760).Unix(),
	}

	appToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := appToken.SignedString(jwtSecret)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal generate token"})
	}

	frontendURL := fmt.Sprintf("%s?token=%s", frontendBaseURL, tokenString)
	return c.Redirect(http.StatusTemporaryRedirect, frontendURL)
}

func GetMe(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)

	var userID int
	if idFloat, ok := claims["user_id"].(float64); ok {
		userID = int(idFloat)
	} else {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token payload"})
	}

	var u struct {
		Name      string `json:"name"`
		Username  string `json:"username"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
		Role      string `json:"role"`
		Status    string `json:"status"`
	}

	query := "SELECT name, username, email, avatar_url, role, status FROM users WHERE id = $1"
	err := config.DB.QueryRow(c.Request().Context(), query, userID).Scan(&u.Name, &u.Username, &u.Email, &u.AvatarURL, &u.Role, &u.Status)

	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Akun tidak ditemukan"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": u,
	})
}

func Logout(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)

	var userID int64
	if idFloat, ok := claims["user_id"].(float64); ok {
		userID = int64(idFloat)
	}

	query := "UPDATE users SET last_login_at = NOW() - INTERVAL '2 hours', fcm_token = NULL WHERE id = $1"

	tag, err := config.DB.Exec(c.Request().Context(), query, userID)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal update status logout"})
	}

	if tag.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User tidak ditemukan"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Berhasil logout dan token FCM dihapus"})
}

func DeleteOldLoginLogs(c echo.Context) error {
	daysStr := c.QueryParam("days")
	days := "30"
	if daysStr != "" {
		days = daysStr
	}

	query := fmt.Sprintf("DELETE FROM login_logs WHERE login_at < NOW() - INTERVAL '%s days'", days)
	tag, err := config.DB.Exec(c.Request().Context(), query)

	if err != nil {
		log.Println("Gagal cleanup logs:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Gagal membersihkan log database",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":       fmt.Sprintf("Berhasil menghapus log yang lebih tua dari %s hari", days),
		"deleted_count": tag.RowsAffected(),
	})
}
