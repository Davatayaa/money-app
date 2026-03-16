package handler

import (
	"money-app-backend/internal/models"
	"money-app-backend/internal/repository"
	"money-app-backend/pkg/response"
	"net/http"
	"strconv"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type CategoryHandler struct {
	repo repository.CategoryRepository
}

func NewCategoryHandler(repo repository.CategoryRepository) *CategoryHandler {
	return &CategoryHandler{repo: repo}
}

func (h *CategoryHandler) CreateCategory(c echo.Context) error {
	var category models.Category
	if err := c.Bind(&category); err != nil {
		return response.Error(c, http.StatusBadRequest, "Invalid Input")
	}

	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	category.UserID = userID

	ctx := c.Request().Context()
	if err := h.repo.CreateCategory(ctx, &category); err != nil {
		return response.Error(c, http.StatusInternalServerError, err.Error())
	}

	return response.Success(c, http.StatusCreated, "Kategori berhasil dibuat", category)
}

func (h *CategoryHandler) GetCategories(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	ctx := c.Request().Context()
	categories, err := h.repo.GetCategories(ctx, userID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, err.Error())
	}

	return response.Success(c, http.StatusOK, "Data kategori ditemukan", categories)
}

func (h *CategoryHandler) UpdateCategory(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "Invalid ID")
	}

	var cat models.Category
	if err := c.Bind(&cat); err != nil {
		return response.Error(c, http.StatusBadRequest, "Invalid JSON")
	}

	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	cat.ID = int64(id)
	cat.UserID = userID

	if cat.Color == "" {
		if cat.Type == "EXPENSE" {
			cat.Color = "#EF4444"
		} else {
			cat.Color = "#10B981"
		}
	}

	ctx := c.Request().Context()
	if err := h.repo.UpdateCategory(ctx, &cat); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal update: "+err.Error())
	}
	return response.Success(c, http.StatusOK, "Updated", nil)
}

func (h *CategoryHandler) DeleteCategory(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "Invalid ID")
	}

	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	ctx := c.Request().Context()
	if err := h.repo.DeleteCategory(ctx, int64(id), userID); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal hapus: "+err.Error())
	}
	return response.Success(c, http.StatusOK, "Deleted", nil)
}
