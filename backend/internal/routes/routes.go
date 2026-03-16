package routes

import (
	"money-app-backend/internal/config"
	"money-app-backend/internal/handler"
	"money-app-backend/internal/middleware"
	"money-app-backend/internal/repository"

	"github.com/labstack/echo/v4"
)

func InitRoutes(e *echo.Echo) {
	walletRepo := repository.NewWalletRepository(config.DB)
	walletHandler := handler.NewWalletHandler(walletRepo)

	categoryRepo := repository.NewCategoryRepository(config.DB)
	categoryHandler := handler.NewCategoryHandler(categoryRepo)

	trxRepo := repository.NewTransactionRepository(config.DB)
	trxHandler := handler.NewTransactionHandler(trxRepo)

	reportHandler := handler.NewReportHandler()
	adminHandler := handler.NewAdminHandler()

	debtRepo := repository.NewDebtRepository(config.DB)
	debtHandler := handler.NewDebtHandler(debtRepo)

	aiHandler := handler.NewAIHandler()

	api := e.Group("/api/v1")

	api.GET("/auth/google-login", handler.GoogleLogin)

	api.GET("/auth/google/callback", handler.GoogleCallback)

	protected := api.Group("")

	protected.Use(middleware.JWTMiddleware)

	adminGroup := protected.Group("/admin")
	adminGroup.Use(middleware.AdminOnly)
	{
		adminGroup.GET("/users", adminHandler.GetAllUsers)
		adminGroup.PUT("/users/:id/status", adminHandler.UpdateUserStatus)
		adminGroup.DELETE("/users/:id", adminHandler.DeleteUser)

		adminGroup.GET("/logs", adminHandler.GetLoginLogs)
		adminGroup.DELETE("/logs/cleanup", handler.DeleteOldLoginLogs)

		adminGroup.POST("/notifications/send", handler.SendNotification)
		adminGroup.POST("/schedules", handler.CreateSchedule)
		adminGroup.GET("/schedules", handler.GetSchedules)
		adminGroup.DELETE("/schedules/:id", handler.DeleteSchedule)
		adminGroup.PUT("/schedules/:id", handler.UpdateSchedule)
	}

	protected.GET("/auth/me", handler.GetMe)
	protected.POST("/logout", handler.Logout)
	protected.PUT("/auth/fcm-token", handler.UpdateFCMToken)

	protected.GET("/notifications", handler.GetNotifications)
	protected.PUT("/notifications/:id/read", handler.MarkNotificationRead)
	protected.DELETE("/notifications/cleanup", handler.CleanupNotifications)

	protected.POST("/wallets", walletHandler.CreateWallet)
	protected.GET("/wallets", walletHandler.GetWallets)
	protected.PUT("/wallets/:id", walletHandler.UpdateWallet)
	protected.DELETE("/wallets/:id", walletHandler.DeleteWallet)

	protected.GET("/categories", categoryHandler.GetCategories)
	protected.POST("/categories", categoryHandler.CreateCategory)
	protected.PUT("/categories/:id", categoryHandler.UpdateCategory)
	protected.DELETE("/categories/:id", categoryHandler.DeleteCategory)

	protected.POST("/transactions", trxHandler.CreateTransaction)
	protected.GET("/transactions", trxHandler.GetTransactions)
	protected.PUT("/transactions/:id", trxHandler.UpdateTransaction)
	protected.DELETE("/transactions/:id", trxHandler.DeleteTransaction)
	protected.POST("/transactions/transfer", trxHandler.TransferFunds)

	protected.GET("/transactions/trend", trxHandler.GetYearlyTrend)

	protected.GET("/transactions/photo/:filename", trxHandler.GetTransactionPhoto)

	protected.GET("/dashboard/stats", trxHandler.GetDashboardStats)
	protected.GET("/reports/monthly", reportHandler.ExportMonthlyReport)
	protected.GET("/reports/export-excel", reportHandler.ExportExcel)

	protected.POST("/ai/analyze", aiHandler.AnalyzeFinancial)

	debtGroup := protected.Group("/debts")

	debtGroup.POST("", debtHandler.CreateDebt)
	debtGroup.GET("", debtHandler.GetDebts)
	debtGroup.PUT("/:id", debtHandler.UpdateDebt)
	debtGroup.PUT("/:id/pay", debtHandler.MarkPaid)
	debtGroup.DELETE("/:id", debtHandler.DeleteDebt)
}
