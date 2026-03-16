package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"money-app-backend/internal/config"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

func JWTMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Missing Authorization Header"})
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid Token Format"})
		}
		tokenString := parts[1]

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(os.Getenv("JWT_SECRET")), nil
		})

		if err != nil || !token.Valid {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid or Expired Token"})
		}

		claims := token.Claims.(jwt.MapClaims)
		userID := int64(claims["user_id"].(float64))

		var status string
		var role string

		query := "SELECT status, role FROM users WHERE id = $1"
		err = config.DB.QueryRow(context.Background(), query, userID).Scan(&status, &role)

		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Akun tidak ditemukan"})
		}

		if role != "admin" && status == "blocked" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Akun dinonaktifkan"})
		}

		c.Set("user", token)
		return next(c)
	}
}

func AdminOnly(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		user := c.Get("user").(*jwt.Token)
		claims := user.Claims.(jwt.MapClaims)

		role, ok := claims["role"].(string)

		if !ok || role != "admin" {
			return c.JSON(http.StatusForbidden, map[string]string{
				"message": "Akses ditolak: Anda bukan Administrator",
			})
		}

		return next(c)
	}
}
