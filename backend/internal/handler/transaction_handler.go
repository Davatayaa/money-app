package handler

import (
	"fmt"
	"io"
	"money-app-backend/internal/config"
	"money-app-backend/internal/models"
	"money-app-backend/internal/repository"
	"money-app-backend/pkg/response"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type TransactionHandler struct {
	repo repository.TransactionRepository
}

func NewTransactionHandler(repo repository.TransactionRepository) *TransactionHandler {
	return &TransactionHandler{repo: repo}
}

type TransferRequest struct {
	FromWalletID int64   `json:"from_wallet_id"`
	ToWalletID   int64   `json:"to_wallet_id"`
	Amount       float64 `json:"amount"`
	Date         string  `json:"date"`
	Description  string  `json:"description"`
}

func (h *TransactionHandler) TransferFunds(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	lang := c.QueryParam("lang")
	if lang == "" {
		lang = "id"
	}

	var req models.TransferRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Invalid input data")
	}

	if req.FromWalletID == req.ToWalletID {
		return response.Error(c, http.StatusBadRequest, "Dompet asal dan tujuan tidak boleh sama")
	}
	if req.Amount <= 0 {
		return response.Error(c, http.StatusBadRequest, "Jumlah transfer harus lebih dari 0")
	}

	ctx := c.Request().Context()
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Database Error")
	}
	defer tx.Rollback(ctx)

	var fromWalletName string
	var currentBalance float64
	err = tx.QueryRow(ctx, "SELECT name, balance FROM wallets WHERE id=$1 AND user_id=$2", req.FromWalletID, userID).Scan(&fromWalletName, &currentBalance)
	if err != nil || currentBalance < req.Amount {
		return response.Error(c, http.StatusBadRequest, "Dompet pengirim tidak valid atau saldo kurang")
	}

	var toWalletName string
	err = tx.QueryRow(ctx, "SELECT name FROM wallets WHERE id=$1 AND user_id=$2", req.ToWalletID, userID).Scan(&toWalletName)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "Dompet tujuan tidak valid")
	}

	var categoryID int
	err = tx.QueryRow(ctx, "SELECT id FROM categories WHERE user_id=$1 AND name ILIKE 'Transfer' LIMIT 1", userID).Scan(&categoryID)
	if err != nil {
		err = tx.QueryRow(ctx, "INSERT INTO categories (user_id, name, type, icon, color) VALUES ($1, 'Transfer', 'EXPENSE', 'fa-exchange', '#9CA3AF') RETURNING id", userID).Scan(&categoryID)
		if err != nil {
			return response.Error(c, http.StatusInternalServerError, "Gagal setup kategori")
		}
	}

	userNote := ""
	if req.Description != "" {
		userNote = fmt.Sprintf(" (%s)", req.Description)
	}

	descOut := fmt.Sprintf("Transfer ke %s%s", toWalletName, userNote)
	descIn := fmt.Sprintf("Terima dari %s%s", fromWalletName, userNote)
	if lang == "en" {
		descOut = fmt.Sprintf("Transfer to %s%s", toWalletName, userNote)
		descIn = fmt.Sprintf("Received from %s%s", fromWalletName, userNote)
	}

	if _, err = tx.Exec(ctx, "UPDATE wallets SET balance = balance - $1 WHERE id = $2", req.Amount, req.FromWalletID); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal potong saldo")
	}
	if _, err = tx.Exec(ctx, "UPDATE wallets SET balance = balance + $1 WHERE id = $2", req.Amount, req.ToWalletID); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal tambah saldo")
	}

	var idOut, idIn int64

	err = tx.QueryRow(ctx, `
        INSERT INTO transactions (user_id, wallet_id, category_id, amount, transaction_type, transaction_date, description)
        VALUES ($1, $2, $3, $4, 'EXPENSE', $5, $6) RETURNING id
    `, userID, req.FromWalletID, categoryID, req.Amount, req.Date, descOut).Scan(&idOut)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal simpan transaksi keluar")
	}

	err = tx.QueryRow(ctx, `
        INSERT INTO transactions (user_id, wallet_id, category_id, amount, transaction_type, transaction_date, description)
        VALUES ($1, $2, $3, $4, 'INCOME', $5, $6) RETURNING id
    `, userID, req.ToWalletID, categoryID, req.Amount, req.Date, descIn).Scan(&idIn)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal simpan transaksi masuk")
	}

	_, err = tx.Exec(ctx, "UPDATE transactions SET related_transaction_id = $1 WHERE id = $2", idIn, idOut)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal linking data 1")
	}

	_, err = tx.Exec(ctx, "UPDATE transactions SET related_transaction_id = $1 WHERE id = $2", idOut, idIn)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal linking data 2")
	}

	if err := tx.Commit(ctx); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal commit transaksi")
	}

	return response.Success(c, http.StatusOK, "Transfer berhasil!", nil)
}

func (h *TransactionHandler) CreateTransaction(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	amountStr := c.FormValue("amount")
	walletIDStr := c.FormValue("wallet_id")
	categoryIDStr := c.FormValue("category_id")
	description := c.FormValue("description")
	dateStr := c.FormValue("date")
	trxType := c.FormValue("type")

	amount, _ := strconv.ParseFloat(amountStr, 64)
	walletID, _ := strconv.ParseInt(walletIDStr, 10, 64)
	categoryID, _ := strconv.ParseInt(categoryIDStr, 10, 64)

	date, err := time.Parse(time.RFC3339, dateStr)
	if err != nil {
		date, _ = time.Parse("2006-01-02", dateStr)
	}

	if amount <= 0 {
		return response.Error(c, http.StatusBadRequest, "Jumlah uang harus lebih dari 0")
	}

	trx := models.Transaction{
		UserID:      userID,
		WalletID:    walletID,
		CategoryID:  categoryID,
		Amount:      amount,
		Type:        trxType,
		Description: description,
		Date:        date,
	}

	ctx := c.Request().Context()

	if err := h.repo.CreateTransaction(ctx, &trx); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal simpan data transaksi: "+err.Error())
	}

	file, err := c.FormFile("photo")
	if err == nil {
		basePath := os.Getenv("STORAGE_PATH")
		if basePath == "" {
			basePath = "./uploads"
		}

		uploadPath := filepath.Join(basePath, "transaction")

		if _, err := os.Stat(uploadPath); os.IsNotExist(err) {
			os.MkdirAll(uploadPath, 0755)
		}

		ext := ".jpg"

		timestamp := time.Now().Format("20060102-150405")

		filename := fmt.Sprintf("%d-%s%s", userID, timestamp, ext)

		savePath := filepath.Join(uploadPath, filename)

		src, err := file.Open()
		if err == nil {
			defer src.Close()
			dst, err := os.Create(savePath)
			if err == nil {
				defer dst.Close()
				if _, err = io.Copy(dst, src); err == nil {

					relativePath := fmt.Sprintf("transaction/%s", filename)
					h.repo.UpdatePhoto(ctx, trx.ID, relativePath)

					trx.PhotoURL = relativePath
				}
			}
		}
	}

	return response.Success(c, http.StatusCreated, "Transaksi berhasil disimpan!", trx)
}

func (h *TransactionHandler) GetTransactions(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	monthStr := c.QueryParam("month")
	yearStr := c.QueryParam("year")

	pageStr := c.QueryParam("page")
	limitStr := c.QueryParam("limit")

	ctx := c.Request().Context()
	var transactions []models.Transaction
	var err error

	if monthStr != "" && yearStr != "" {
		month, _ := strconv.Atoi(monthStr)
		year, _ := strconv.Atoi(yearStr)
		transactions, err = h.repo.GetTransactionsByMonth(ctx, userID, month, year)
	} else {
		page := 1
		limit := 50

		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}

		offset := (page - 1) * limit
		transactions, err = h.repo.GetTransactions(ctx, userID, limit, offset)
	}

	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal ambil data: "+err.Error())
	}

	if transactions == nil {
		transactions = []models.Transaction{}
	}

	return response.Success(c, http.StatusOK, "Riwayat transaksi ditemukan", transactions)
}

func (h *TransactionHandler) GetDashboardStats(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	monthStr := c.QueryParam("month")
	yearStr := c.QueryParam("year")

	month := int(time.Now().Month())
	year := time.Now().Year()

	if monthStr != "" {
		if m, err := strconv.Atoi(monthStr); err == nil {
			month = m
		}
	}
	if yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil {
			year = y
		}
	}

	ctx := c.Request().Context()

	stats, err := h.repo.GetDashboardStats(ctx, userID, month, year)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menghitung statistik: "+err.Error())
	}

	return response.Success(c, http.StatusOK, "Data dashboard berhasil dimuat", stats)
}

func (h *TransactionHandler) UpdateTransaction(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID Transaksi tidak valid")
	}

	var trx models.Transaction
	if err := c.Bind(&trx); err != nil {
		return response.Error(c, http.StatusBadRequest, "Invalid Input JSON")
	}

	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	trx.ID = id
	trx.UserID = userID

	ctx := c.Request().Context()
	if err := h.repo.UpdateTransaction(ctx, &trx); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal update transaksi: "+err.Error())
	}

	return response.Success(c, http.StatusOK, "Transaksi berhasil diupdate", trx)
}

func (h *TransactionHandler) DeleteTransaction(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID Transaksi tidak valid")
	}

	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	ctx := c.Request().Context()

	if err := h.repo.DeleteTransaction(ctx, id, userID); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menghapus transaksi: "+err.Error())
	}

	return response.Success(c, http.StatusOK, "Transaksi berhasil dihapus (Saldo dikembalikan)", true)
}

func (h *TransactionHandler) GetTransactionPhoto(c echo.Context) error {
	filename := c.Param("filename")

	basePath := os.Getenv("STORAGE_PATH")
	if basePath == "" {
		basePath = "./uploads"
	}

	imagePath := filepath.Join(basePath, "transaction", filename)

	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		return response.Error(c, http.StatusNotFound, "Foto tidak ditemukan")
	}

	return c.Inline(imagePath, filename)
}

func (h *TransactionHandler) GetYearlyTrend(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	yearStr := c.QueryParam("year")
	year := time.Now().Year()
	if yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil {
			year = y
		}
	}

	ctx := c.Request().Context()
	trends, err := h.repo.GetYearlyTrend(ctx, userID, year)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memuat tren: "+err.Error())
	}

	return response.Success(c, http.StatusOK, "Data tren tahunan berhasil dimuat", trends)
}
