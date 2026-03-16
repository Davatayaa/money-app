package handler

import (
	"fmt"
	"math"
	"money-app-backend/internal/config"
	"money-app-backend/internal/models"
	"money-app-backend/internal/repository"
	"money-app-backend/pkg/response"
	"net/http"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type WalletHandler struct {
	repo repository.WalletRepository
}

func NewWalletHandler(repo repository.WalletRepository) *WalletHandler {
	return &WalletHandler{repo: repo}
}

type UpdateWalletRequest struct {
	Name            string  `json:"name"`
	Type            string  `json:"type"`
	Balance         float64 `json:"balance"`
	CategoryID      int64   `json:"category_id"`
	TransactionDate string  `json:"transaction_date"`
}

func (h *WalletHandler) CreateWallet(c echo.Context) error {
	var wallet models.Wallet
	if err := c.Bind(&wallet); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format JSON salah")
	}
	if wallet.Name == "" || wallet.Type == "" {
		return response.Error(c, http.StatusBadRequest, "Nama dan Tipe wajib diisi")
	}

	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))
	wallet.UserID = userID
	wallet.Balance = 0

	ctx := c.Request().Context()
	if err := h.repo.CreateWallet(ctx, &wallet); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal membuat dompet: "+err.Error())
	}
	return response.Success(c, http.StatusCreated, "Dompet berhasil dibuat", wallet)
}

func (h *WalletHandler) GetWallets(c echo.Context) error {
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

	wallets, err := h.repo.GetWalletsByUserID(ctx, userID, month, year)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil data dompet: "+err.Error())
	}

	return response.Success(c, http.StatusOK, "Data dompet ditemukan", wallets)
}

func (h *WalletHandler) UpdateWallet(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID harus berupa angka")
	}

	var req UpdateWalletRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Invalid JSON")
	}

	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	ctx := c.Request().Context()

	oldWallet, err := h.repo.GetWalletByID(ctx, int64(id))
	if err != nil {
		return response.Error(c, http.StatusNotFound, "Dompet tidak ditemukan")
	}
	if oldWallet.UserID != userID {
		return response.Error(c, http.StatusForbidden, "Akses ditolak")
	}

	diff := req.Balance - oldWallet.Balance
	var adjustmentTrx *models.Transaction = nil

	if diff != 0 {
		adjustCatID, err := h.repo.GetOrCreateAdjustmentCategory(ctx, userID)
		if err != nil {
			return response.Error(c, http.StatusInternalServerError, "Gagal menyiapkan kategori koreksi: "+err.Error())
		}

		trxDate := time.Now()
		if req.TransactionDate != "" {
			parsedTime, err := time.Parse(time.RFC3339, req.TransactionDate)
			if err == nil {
				trxDate = parsedTime
			}
		}

		adjustmentTrx = &models.Transaction{
			UserID:     userID,
			WalletID:   int64(id),
			CategoryID: adjustCatID,
			Date:       trxDate,
		}

		if diff > 0 {
			adjustmentTrx.Type = "INCOME"
			adjustmentTrx.Amount = diff
			adjustmentTrx.Description = fmt.Sprintf("Balance Adjustment: +Rp %.0f (Manual)", diff)
		} else {
			adjustmentTrx.Type = "EXPENSE"
			adjustmentTrx.Amount = math.Abs(diff)
			adjustmentTrx.Description = fmt.Sprintf("Balance Adjustment: -Rp %.0f (Manual)", math.Abs(diff))
		}
	}

	walletToUpdate := &models.Wallet{
		ID:      int64(id),
		UserID:  userID,
		Name:    req.Name,
		Type:    req.Type,
		Balance: req.Balance,
	}

	if err := h.repo.UpdateWallet(ctx, walletToUpdate, adjustmentTrx); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal update: "+err.Error())
	}

	return response.Success(c, http.StatusOK, "Dompet berhasil diupdate", nil)
}

func (h *WalletHandler) DeleteWallet(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID harus berupa angka")
	}

	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	ctx := c.Request().Context()

	var count int
	errCheck := config.DB.QueryRow(ctx, "SELECT COUNT(*) FROM transactions WHERE wallet_id = $1", id).Scan(&count)

	if errCheck == nil && count > 0 {
		return response.Error(c, http.StatusConflict, fmt.Sprintf("Gagal hapus! Dompet ini masih memiliki %d riwayat transaksi. Hapus transaksinya terlebih dahulu.", count))
	}

	if err := h.repo.DeleteWallet(ctx, int64(id), userID); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal hapus: "+err.Error())
	}

	return response.Success(c, http.StatusOK, "Dompet berhasil dihapus", nil)
}
