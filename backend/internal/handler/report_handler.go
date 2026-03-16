package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/johnfercher/maroto/pkg/color"
	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
	"github.com/labstack/echo/v4"
	"github.com/xuri/excelize/v2"
	"golang.org/x/text/language"
	"golang.org/x/text/message"

	"money-app-backend/internal/config"
	"money-app-backend/internal/models"
)

type ReportHandler struct{}

func NewReportHandler() *ReportHandler {
	return &ReportHandler{}
}

func formatRupiah(amount float64) string {
	p := message.NewPrinter(language.Indonesian)
	return p.Sprintf("Rp %.0f", amount)
}

func getDownloadDateParam() string {
	return time.Now().Format("020106")
}

type PDFLabels struct {
	Title        string
	Period       string
	DateCol      string
	DescCol      string
	TypeCol      string
	AmountCol    string
	TypeExpense  string
	TypeIncome   string
	TotalIncome  string
	TotalExpense string
	NetBalance   string
}

func (h *ReportHandler) ExportMonthlyReport(c echo.Context) error {
	monthStr := c.QueryParam("month")
	yearStr := c.QueryParam("year")
	appVersion := c.QueryParam("app_version")
	lang := c.QueryParam("lang")

	if appVersion == "" {
		appVersion = "Money App v1.0.0"
	}

	month, _ := strconv.Atoi(monthStr)
	year, _ := strconv.Atoi(yearStr)

	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	isYearly := (month == 0)

	labels := PDFLabels{
		Title: "Laporan Keuangan", Period: "Periode", DateCol: "Tanggal", DescCol: "Keterangan",
		TypeCol: "Tipe", AmountCol: "Nominal", TypeExpense: "Pengeluaran", TypeIncome: "Pemasukan",
		TotalIncome: "Total Pemasukan:", TotalExpense: "Total Pengeluaran:", NetBalance: "Sisa Saldo:",
	}
	indoMonths := []string{"", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"}
	monthName := ""

	if lang == "en" {
		labels = PDFLabels{
			Title: "Financial Report", Period: "Period", DateCol: "Date", DescCol: "Description",
			TypeCol: "Type", AmountCol: "Amount", TypeExpense: "Expense", TypeIncome: "Income",
			TotalIncome: "Total Income:", TotalExpense: "Total Expense:", NetBalance: "Net Balance:",
		}
		if !isYearly {
			monthName = time.Month(month).String()
		}
	} else {
		if !isYearly && month >= 1 && month <= 12 {
			monthName = indoMonths[month]
		}
	}

	var startDate, endDate time.Time
	if isYearly {
		startDate = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate = startDate.AddDate(1, 0, 0)
	} else {
		startDate = time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		endDate = startDate.AddDate(0, 1, 0)
	}

	query := `
		SELECT 
			t.id, t.amount, t.transaction_type, t.transaction_date, t.description 
		FROM transactions t
		WHERE 
			t.transaction_date >= $1 
			AND t.transaction_date < $2 
			AND t.user_id = $3
		ORDER BY t.transaction_date ASC
	`

	rows, err := config.DB.Query(context.Background(), query, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Database query error"})
	}
	defer rows.Close()

	var transactions []models.Transaction
	for rows.Next() {
		var t models.Transaction
		if err := rows.Scan(&t.ID, &t.Amount, &t.Type, &t.Date, &t.Description); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Scanning error"})
		}
		transactions = append(transactions, t)
	}

	if len(transactions) == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "No data"})
	}

	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(20, 10, 20)

	headerColor := color.Color{Red: 66, Green: 135, Blue: 245}
	whiteColor := color.NewWhite()

	m.RegisterHeader(func() {
		m.SetBackgroundColor(headerColor)
		m.Row(25, func() {
			m.Col(12, func() {
				m.Text(labels.Title, props.Text{Top: 6, Style: consts.Bold, Size: 18, Align: consts.Center, Color: whiteColor})
				periodText := fmt.Sprintf("%d", year)
				if !isYearly {
					periodText = fmt.Sprintf("%s %d", monthName, year)
				}
				m.Text(fmt.Sprintf("%s: %s", labels.Period, periodText), props.Text{Top: 16, Size: 10, Align: consts.Center, Color: whiteColor})
			})
		})
		m.SetBackgroundColor(whiteColor)
	})

	m.RegisterFooter(func() {
		m.Row(10, func() {
			m.Col(12, func() {
				m.Text(appVersion, props.Text{Top: 5, Size: 8, Align: consts.Right, Color: color.Color{Red: 150, Green: 150, Blue: 150}, Style: consts.Italic})
			})
		})
	})

	m.Row(10, func() {
		m.Col(3, func() { m.Text(labels.DateCol, props.Text{Style: consts.Bold}) })
		m.Col(4, func() { m.Text(labels.DescCol, props.Text{Style: consts.Bold}) })
		m.Col(2, func() { m.Text(labels.TypeCol, props.Text{Style: consts.Bold}) })
		m.Col(3, func() { m.Text(labels.AmountCol, props.Text{Style: consts.Bold, Align: consts.Right}) })
	})
	m.Line(1.0)

	var totalIncome, totalExpense float64
	var lastMonth time.Month = 0
	grayColor := color.Color{Red: 245, Green: 245, Blue: 245}
	sepColor := color.Color{Red: 230, Green: 240, Blue: 255}

	for i, trx := range transactions {
		currentMonth := trx.Date.Month()
		if currentMonth != lastMonth {
			m.SetBackgroundColor(sepColor)
			m.Row(6, func() {
				mLabel := currentMonth.String()
				if lang != "en" {
					mLabel = indoMonths[currentMonth]
				}
				m.Col(12, func() {
					m.Text(fmt.Sprintf("%s %d", mLabel, trx.Date.Year()), props.Text{Top: 1, Style: consts.BoldItalic, Size: 9})
				})
			})
			lastMonth = currentMonth
		}

		if i%2 == 0 {
			m.SetBackgroundColor(grayColor)
		} else {
			m.SetBackgroundColor(whiteColor)
		}

		isTransfer := strings.Contains(strings.ToLower(trx.Description), "transfer") ||
			strings.Contains(strings.ToLower(trx.Description), "terima dari") ||
			strings.Contains(strings.ToLower(trx.Description), "pindah dana")

		m.Row(6, func() {
			m.Col(3, func() { m.Text(trx.Date.Format("02 Jan 2006"), props.Text{Size: 8, Top: 1}) })
			m.Col(4, func() { m.Text(trx.Description, props.Text{Size: 8, Top: 1}) })

			if trx.Type == "EXPENSE" {
				if !isTransfer {
					totalExpense += trx.Amount
				}

				displayLabel := labels.TypeExpense
				if isTransfer {
					displayLabel = "Transfer"
				}

				m.Col(2, func() {
					m.Text(displayLabel, props.Text{Size: 8, Top: 1, Color: color.Color{Red: 200, Green: 0, Blue: 0}})
				})
			} else {
				if !isTransfer {
					totalIncome += trx.Amount
				}

				displayLabel := labels.TypeIncome
				if isTransfer {
					displayLabel = "Transfer"
				}

				m.Col(2, func() {
					m.Text(displayLabel, props.Text{Size: 8, Top: 1, Color: color.Color{Red: 0, Green: 128, Blue: 0}})
				})
			}
			m.Col(3, func() { m.Text(formatRupiah(trx.Amount), props.Text{Size: 8, Top: 1, Align: consts.Right}) })
		})
	}
	m.SetBackgroundColor(whiteColor)
	m.Line(1.0)

	m.Row(8, func() {
		m.Col(9, func() { m.Text(labels.TotalIncome, props.Text{Style: consts.Bold, Align: consts.Right}) })
		m.Col(3, func() {
			m.Text(formatRupiah(totalIncome), props.Text{Color: color.Color{Red: 0, Green: 128, Blue: 0}, Align: consts.Right, Style: consts.Bold})
		})
	})
	m.Row(8, func() {
		m.Col(9, func() { m.Text(labels.TotalExpense, props.Text{Style: consts.Bold, Align: consts.Right}) })
		m.Col(3, func() {
			m.Text(formatRupiah(totalExpense), props.Text{Color: color.Color{Red: 200, Green: 0, Blue: 0}, Align: consts.Right, Style: consts.Bold})
		})
	})
	m.Row(8, func() {
		net := totalIncome - totalExpense
		m.Col(9, func() { m.Text(labels.NetBalance, props.Text{Style: consts.Bold, Align: consts.Right}) })
		m.Col(3, func() { m.Text(formatRupiah(net), props.Text{Style: consts.Bold, Align: consts.Right}) })
	})

	buffer, err := m.Output()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal generate PDF"})
	}

	downloadDate := getDownloadDateParam()
	filename := ""
	if isYearly {
		filename = fmt.Sprintf("%d_Report_%s.pdf", year, downloadDate)
	} else {
		filename = fmt.Sprintf("%s_%d_Report_%s.pdf", monthName, year, downloadDate)
	}

	c.Response().Header().Set("Content-Disposition", "attachment; filename="+filename)
	return c.Blob(http.StatusOK, "application/pdf", buffer.Bytes())
}

func (h *ReportHandler) ExportExcel(c echo.Context) error {
	monthStr := c.QueryParam("month")
	yearStr := c.QueryParam("year")
	lang := c.QueryParam("lang")
	appVersion := c.QueryParam("app_version")

	month, _ := strconv.Atoi(monthStr)
	year, _ := strconv.Atoi(yearStr)

	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	isYearly := (month == 0)

	labelPeriod, colDate, colDesc, colType, colAmount := "Periode", "Tanggal", "Keterangan", "Tipe", "Nominal"
	typeExp, typeInc := "Pengeluaran", "Pemasukan"
	title, labelTotalInc, labelTotalExp, labelNet := "Laporan Keuangan", "Total Pemasukan", "Total Pengeluaran", "Sisa Saldo"
	indoMonths := []string{"", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"}
	periodInfo, filenameMonth := "", ""

	if lang == "en" {
		labelPeriod, colDate, colDesc, colType, colAmount = "Period", "Date", "Description", "Type", "Amount"
		typeExp, typeInc = "Expense", "Income"
		title, labelTotalInc, labelTotalExp, labelNet = "Financial Report", "Total Income", "Total Expense", "Net Balance"
		if isYearly {
			periodInfo = fmt.Sprintf("%d", year)
		} else {
			mName := time.Month(month).String()
			periodInfo = fmt.Sprintf("%s %d", mName, year)
			filenameMonth = mName
		}
	} else {
		if isYearly {
			periodInfo = fmt.Sprintf("%d", year)
		} else {
			if month >= 1 && month <= 12 {
				mName := indoMonths[month]
				periodInfo = fmt.Sprintf("%s %d", mName, year)
				filenameMonth = mName
			}
		}
	}

	var startDate, endDate time.Time
	if isYearly {
		startDate = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate = startDate.AddDate(1, 0, 0)
	} else {
		startDate = time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		endDate = startDate.AddDate(0, 1, 0)
	}

	query := `
		SELECT 
			t.id, t.amount, t.transaction_type, t.transaction_date, t.description 
		FROM transactions t
		WHERE 
			t.transaction_date >= $1 
			AND t.transaction_date < $2 
			AND t.user_id = $3
		ORDER BY t.transaction_date ASC
	`

	rows, err := config.DB.Query(context.Background(), query, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Database error"})
	}
	defer rows.Close()

	var transactions []models.Transaction
	for rows.Next() {
		var t models.Transaction
		rows.Scan(&t.ID, &t.Amount, &t.Type, &t.Date, &t.Description)
		transactions = append(transactions, t)
	}

	if len(transactions) == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "No data"})
	}

	f := excelize.NewFile()
	sheetName := "Laporan"
	index, _ := f.NewSheet(sheetName)
	f.DeleteSheet("Sheet1")

	styleTitle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 16, Color: "1F4E78"}, Alignment: &excelize.Alignment{Horizontal: "center"}})
	styleInfo, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Size: 11}, Alignment: &excelize.Alignment{Horizontal: "center"}})
	styleBranding, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Italic: true, Size: 9, Color: "808080"}, Alignment: &excelize.Alignment{Horizontal: "center"}})
	styleHead, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Color: "FFFFFF"}, Fill: excelize.Fill{Type: "pattern", Color: []string{"4472C4"}, Pattern: 1}, Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"}})
	styleMonthSep, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}, Fill: excelize.Fill{Type: "pattern", Color: []string{"FFEB9C"}, Pattern: 1}})
	formatRp := "_(\"Rp\"* #,##0_);_(\"Rp\"* (#,##0);_(\"Rp\"* \"-\"_);_(@_)"
	styleCurrGreen, _ := f.NewStyle(&excelize.Style{CustomNumFmt: &formatRp, Font: &excelize.Font{Color: "006100"}})
	styleCurrRed, _ := f.NewStyle(&excelize.Style{CustomNumFmt: &formatRp, Font: &excelize.Font{Color: "9C0006"}})
	styleBoldCurr, _ := f.NewStyle(&excelize.Style{CustomNumFmt: &formatRp, Font: &excelize.Font{Bold: true}})

	f.SetCellValue(sheetName, "A1", title)
	f.SetCellValue(sheetName, "A2", labelPeriod+": "+periodInfo)
	f.SetCellValue(sheetName, "A3", appVersion)
	f.MergeCell(sheetName, "A1", "D1")
	f.MergeCell(sheetName, "A2", "D2")
	f.MergeCell(sheetName, "A3", "D3")
	f.SetCellStyle(sheetName, "A1", "A1", styleTitle)
	f.SetCellStyle(sheetName, "A2", "A2", styleInfo)
	f.SetCellStyle(sheetName, "A3", "A3", styleBranding)

	headers := []string{colDate, colDesc, colType, colAmount}
	for i, h := range headers {
		cell := fmt.Sprintf("%s5", string(rune('A'+i)))
		f.SetCellValue(sheetName, cell, h)
		f.SetCellStyle(sheetName, cell, cell, styleHead)
	}

	currentRow := 6
	var totalIncome, totalExpense float64
	var lastMonth time.Month = 0

	for _, trx := range transactions {
		currentMonth := trx.Date.Month()
		if currentMonth != lastMonth {
			mLabel := currentMonth.String()
			if lang != "en" {
				mLabel = indoMonths[currentMonth]
			}
			sepCell := fmt.Sprintf("A%d", currentRow)
			f.SetCellValue(sheetName, sepCell, fmt.Sprintf("%s %d", mLabel, trx.Date.Year()))
			f.MergeCell(sheetName, sepCell, fmt.Sprintf("D%d", currentRow))
			f.SetCellStyle(sheetName, sepCell, fmt.Sprintf("D%d", currentRow), styleMonthSep)
			currentRow++
			lastMonth = currentMonth
		}

		f.SetCellValue(sheetName, fmt.Sprintf("A%d", currentRow), trx.Date.Format("2006-01-02"))
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", currentRow), trx.Description)

		isTransfer := strings.Contains(strings.ToLower(trx.Description), "transfer") ||
			strings.Contains(strings.ToLower(trx.Description), "terima dari") ||
			strings.Contains(strings.ToLower(trx.Description), "pindah dana")

		displayType := typeInc
		styleForAmount := styleCurrGreen

		if trx.Type == "EXPENSE" {
			displayType = typeExp
			styleForAmount = styleCurrRed
			if !isTransfer {
				totalExpense += trx.Amount
			} else {
				displayType = "Transfer"
			}
		} else {
			if !isTransfer {
				totalIncome += trx.Amount
			} else {
				displayType = "Transfer"
			}
		}

		f.SetCellValue(sheetName, fmt.Sprintf("C%d", currentRow), displayType)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", currentRow), trx.Amount)
		f.SetCellStyle(sheetName, fmt.Sprintf("D%d", currentRow), fmt.Sprintf("D%d", currentRow), styleForAmount)
		currentRow++
	}

	sumRow := currentRow + 1
	f.SetCellValue(sheetName, fmt.Sprintf("C%d", sumRow), labelTotalInc)
	f.SetCellValue(sheetName, fmt.Sprintf("D%d", sumRow), totalIncome)
	f.SetCellStyle(sheetName, fmt.Sprintf("D%d", sumRow), fmt.Sprintf("D%d", sumRow), styleCurrGreen)
	f.SetCellValue(sheetName, fmt.Sprintf("C%d", sumRow+1), labelTotalExp)
	f.SetCellValue(sheetName, fmt.Sprintf("D%d", sumRow+1), totalExpense)
	f.SetCellStyle(sheetName, fmt.Sprintf("D%d", sumRow+1), fmt.Sprintf("D%d", sumRow+1), styleCurrRed)

	net := totalIncome - totalExpense
	f.SetCellValue(sheetName, fmt.Sprintf("C%d", sumRow+2), labelNet)
	f.SetCellValue(sheetName, fmt.Sprintf("D%d", sumRow+2), net)
	f.SetCellStyle(sheetName, fmt.Sprintf("D%d", sumRow+2), fmt.Sprintf("D%d", sumRow+2), styleBoldCurr)

	f.SetColWidth(sheetName, "A", "A", 15)
	f.SetColWidth(sheetName, "B", "B", 40)
	f.SetColWidth(sheetName, "C", "C", 20)
	f.SetColWidth(sheetName, "D", "D", 20)
	f.SetActiveSheet(index)

	downloadDate := getDownloadDateParam()
	filename := ""
	if isYearly {
		filename = fmt.Sprintf("%d_Report_%s.xlsx", year, downloadDate)
	} else {
		filename = fmt.Sprintf("%s_%d_Report_%s.xlsx", filenameMonth, year, downloadDate)
	}

	c.Response().Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Response().Header().Set("Content-Disposition", "attachment; filename="+filename)

	if err := f.Write(c.Response().Writer); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to write excel"})
	}
	return nil
}
