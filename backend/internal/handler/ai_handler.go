package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/text/language"
	"golang.org/x/text/message"

	"money-app-backend/internal/config"
)

type AIHandler struct{}

func NewAIHandler() *AIHandler {
	return &AIHandler{}
}

var keyRotationCounter uint64

type GeminiRequest struct {
	Contents []GeminiContent `json:"contents"`
}
type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}
type GeminiPart struct {
	Text string `json:"text"`
}
type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func formatRupiahPrompt(amount float64) string {
	p := message.NewPrinter(language.Indonesian)
	return p.Sprintf("Rp %.0f", amount)
}

type TransactionContext struct {
	Date     string  `json:"date"`
	Desc     string  `json:"description"`
	Amount   float64 `json:"amount"`
	Type     string  `json:"type"`
	Category string  `json:"category"`
}

type DebtContext struct {
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
	Type   string  `json:"type"`
}

type CategorySummary struct {
	Category string  `json:"category"`
	Total    float64 `json:"total"`
	Count    int     `json:"count"`
	Type     string  `json:"type"`
}

type AIRequest struct {
	Message string `json:"message"`
	Month   int    `json:"month"`
	Year    int    `json:"year"`
	Scope   string `json:"scope"`
	Lang    string `json:"lang"`
}

func getNextAPIKey() string {
	keysString := os.Getenv("GEMINI_API_KEYS")
	if keysString == "" {
		return os.Getenv("GEMINI_API_KEY")
	}

	keys := strings.Split(keysString, ",")

	var cleanKeys []string
	for _, k := range keys {
		trimmed := strings.TrimSpace(k)
		if trimmed != "" {
			cleanKeys = append(cleanKeys, trimmed)
		}
	}

	if len(cleanKeys) == 0 {
		return ""
	}

	n := atomic.AddUint64(&keyRotationCounter, 1)

	index := (n - 1) % uint64(len(cleanKeys))

	return cleanKeys[index]
}

func (h *AIHandler) AnalyzeFinancial(c echo.Context) error {
	userToken := c.Get("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)
	userID := int64(claims["user_id"].(float64))

	var req AIRequest
	if err := c.Bind(&req); err != nil {
	}

	if req.Month == 0 {
		if m := c.QueryParam("month"); m != "" {
			req.Month, _ = strconv.Atoi(m)
		}
	}
	if req.Year == 0 {
		if y := c.QueryParam("year"); y != "" {
			req.Year, _ = strconv.Atoi(y)
		}
	}
	if req.Scope == "" {
		req.Scope = c.QueryParam("scope")
	}

	now := time.Now()
	if req.Year == 0 {
		req.Year = now.Year()
	}
	if req.Scope == "yearly" {
		req.Month = 0
	} else if req.Month == 0 {
		req.Month = int(now.Month())
	}

	var startDate, endDate time.Time
	var periodLabel string

	if req.Month == 0 {
		startDate = time.Date(req.Year, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate = startDate.AddDate(1, 0, 0)
		periodLabel = fmt.Sprintf("TAHUN %d", req.Year)
	} else {
		startDate = time.Date(req.Year, time.Month(req.Month), 1, 0, 0, 0, 0, time.UTC)
		endDate = startDate.AddDate(0, 1, 0)
		indoMonths := []string{"", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"}
		periodLabel = fmt.Sprintf("BULAN %s %d", indoMonths[time.Month(req.Month)], req.Year)
	}

	rows, err := config.DB.Query(context.Background(), `
		SELECT t.transaction_date, t.description, t.amount, t.transaction_type, c.name
		FROM transactions t
		JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = $1 AND t.transaction_date >= $2 AND t.transaction_date < $3
		ORDER BY t.transaction_date ASC
	`, userID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))

	var transactions []TransactionContext
	var totalIncome, totalExpense float64

	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t TransactionContext
			var date time.Time
			if err := rows.Scan(&date, &t.Desc, &t.Amount, &t.Type, &t.Category); err == nil {
				t.Date = date.Format("2006-01-02")
				transactions = append(transactions, t)
				if t.Type == "INCOME" {
					totalIncome += t.Amount
				} else {
					totalExpense += t.Amount
				}
			}
		}
	}

	debtRows, err := config.DB.Query(context.Background(), `SELECT name, amount, type FROM debts WHERE user_id = $1`, userID)
	var debts []DebtContext
	var totalDebtPayable float64

	if err == nil {
		defer debtRows.Close()
		for debtRows.Next() {
			var d DebtContext
			if err := debtRows.Scan(&d.Name, &d.Amount, &d.Type); err == nil {
				debts = append(debts, d)
				if d.Type == "PAYABLE" {
					totalDebtPayable += d.Amount
				}
			}
		}
	}

	var finalTrxJSON []byte
	var dataNote string

	if len(transactions) > 50 {
		summaryMap := make(map[string]*CategorySummary)
		for _, t := range transactions {
			key := t.Category + "-" + t.Type
			if _, exists := summaryMap[key]; !exists {
				summaryMap[key] = &CategorySummary{Category: t.Category, Type: t.Type, Total: 0, Count: 0}
			}
			summaryMap[key].Total += t.Amount
			summaryMap[key].Count++
		}
		var summaries []CategorySummary
		for _, s := range summaryMap {
			summaries = append(summaries, *s)
		}
		finalTrxJSON, _ = json.Marshal(summaries)
		dataNote = "(CATATAN AI: Data transaksi di atas adalah RINGKASAN per Kategori karena data aslinya terlalu banyak)"
	} else {
		finalTrxJSON, _ = json.Marshal(transactions)
		dataNote = "(Data transaksi lengkap)"
	}
	debtJSON, _ := json.Marshal(debts)

	basePrompt := fmt.Sprintf(`
		Kamu adalah 'monAI', asisten keuangan pribadi. 
		
		INSTRUKSI GAYA BAHASA & FORMAT:
		1. Gunakan bahasa Indonesia yang santai tapi sopan dan mudah dimengerti.
		2. **SANGAT PENTING**: Jawablah dengan format yang bersih dan minimalis.
		3. Hindari penggunaan emoji yang berlebihan (maksimal 1-2 emoji saja per respon, atau tidak sama sekali jika tidak perlu).
		4. Jangan gunakan terlalu banyak simbol markdown seperti (**tebal**) jika tidak benar-benar untuk penekanan penting.
		5. Gunakan poin-poin (bullet points) untuk menjabarkan rincian agar teks tidak terlihat menumpuk/ramai.
		6. Berikan jarak antar paragraf agar enak dibaca.
		
		KONTEKS WAKTU: Periode **%s**.
		
		DATA KEUANGAN:
		- Pemasukan: %s
		- Pengeluaran: %s
		- Sisa Cashflow: %s
		- Total Hutang: %s
		
		DATA TRANSAKSI:
		%s
		%s

		DAFTAR HUTANG:
		%s
	`, periodLabel,
		formatRupiahPrompt(totalIncome),
		formatRupiahPrompt(totalExpense),
		formatRupiahPrompt(totalIncome-totalExpense),
		formatRupiahPrompt(totalDebtPayable),
		string(finalTrxJSON),
		dataNote,
		string(debtJSON),
	)

	var finalPrompt string
	if req.Message == "" || req.Message == "START_ANALYSIS" {
		finalPrompt = basePrompt + `
		
		Tugas: Berikan analisa keuangan singkat dan jelas.
		
		Struktur Jawaban:
		1. Evaluasi Singkat (Positif/Negatif)
		2. Sorotan Pengeluaran (Sebutkan yang paling boros/besar saja)
		3. Saran Hutang (Jika ada hutang, sarankan cara bayar. Jika tidak, lewati)
		4. Rekomendasi Aksi (Poin-poin singkat apa yang harus dilakukan)
		`
	} else {
		finalPrompt = basePrompt + fmt.Sprintf(`
		User Bertanya: "%s"
		
		Jawablah pertanyaan tersebut secara langsung (to-the-point).
		Gunakan data di atas sebagai dasar jawaban.
		Jangan bertele-tele.
		`, req.Message)
	}

	apiKey := getNextAPIKey()

	if apiKey == "" {
		return c.JSON(500, map[string]string{"error": "Tidak ada API Key yang tersedia di server"})
	}

	potentialModels := []string{
		"gemini-2.5-flash",
		"gemini-2.5-flash-lite",
		"gemini-2.0-flash",
	}

	var lastErrorBody string
	var successResp GeminiResponse
	var isSuccess bool

	client := &http.Client{Timeout: 60 * time.Second}

	for _, modelName := range potentialModels {
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", modelName, apiKey)

		keyMask := "...."
		if len(apiKey) > 4 {
			keyMask += apiKey[len(apiKey)-4:]
		}
		fmt.Printf("🔄 MonAI (Key: %s) -> Model: %s\n", keyMask, modelName)

		reqBody := GeminiRequest{Contents: []GeminiContent{{Parts: []GeminiPart{{Text: finalPrompt}}}}}
		jsonBody, _ := json.Marshal(reqBody)

		httpReq, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(httpReq)
		if err != nil {
			fmt.Printf("❌ Gagal Koneksi %s: %v\n", modelName, err)
			continue
		}

		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode == 200 {
			if err := json.Unmarshal(bodyBytes, &successResp); err == nil {
				if len(successResp.Candidates) > 0 && len(successResp.Candidates[0].Content.Parts) > 0 {
					isSuccess = true
					break
				}
			}
		} else {
			lastErrorBody = string(bodyBytes)
			fmt.Printf("⚠️ Gagal %s (Status: %d)\n", modelName, resp.StatusCode)
		}
	}

	if isSuccess {
		return c.JSON(200, map[string]interface{}{
			"period":   periodLabel,
			"analysis": successResp.Candidates[0].Content.Parts[0].Text,
		})
	}

	return c.JSON(500, map[string]string{
		"error":     "Maaf, monAI sedang tidak bisa terhubung ke otak Google.",
		"debug_msg": lastErrorBody,
	})
}
