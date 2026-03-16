package scheduler

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"money-app-backend/internal/config"
	"money-app-backend/internal/utils"
)

func StartDebtReminder() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	go checkDebts()
	for range ticker.C {
		checkDebts()
	}
}

func formatRupiah(amount float64) string {
	s := fmt.Sprintf("%.0f", amount)
	n := len(s)
	if n <= 3 {
		return s
	}
	var result []byte
	reminder := n % 3
	if reminder > 0 {
		result = append(result, s[:reminder]...)
		if reminder < n {
			result = append(result, '.')
		}
	}
	for i := reminder; i < n; i += 3 {
		result = append(result, s[i:i+3]...)
		if i+3 < n {
			result = append(result, '.')
		}
	}
	return string(result)
}

func formatDateIndo(t time.Time) string {
	str := t.Format("02 Jan 2006")
	replacer := strings.NewReplacer(
		"Jan", "Januari", "Feb", "Februari", "Mar", "Maret",
		"Apr", "April", "May", "Mei", "Jun", "Juni",
		"Jul", "Juli", "Aug", "Agustus", "Sep", "September",
		"Oct", "Oktober", "Nov", "November", "Dec", "Desember",
	)
	return replacer.Replace(str)
}

func checkDebts() {
	ctx := context.Background()

	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*60*60)
	}

	now := time.Now().In(loc)
	todayStr := now.Format("2006-01-02")
	currentTimeStr := now.Format("15:04")

	log.Printf("🔍 Scheduler Scan: %s jam %s", todayStr, currentTimeStr)

	query := `
		SELECT id, user_id, person_name, amount, type, due_date, reminder_days_before, reminder_time 
		FROM debts 
		WHERE status = 'BELUM_LUNAS'
	`

	rows, err := config.DB.Query(ctx, query)
	if err != nil {
		log.Println("❌ Error Query DB:", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		count++
		var id, userID, reminderDays int
		var personName, dtype, reminderTime string
		var amount float64
		var dueDate *time.Time

		err := rows.Scan(&id, &userID, &personName, &amount, &dtype, &dueDate, &reminderDays, &reminderTime)
		if err != nil {
			continue
		}

		if dueDate == nil {
			continue
		}

		notifyDate := dueDate.AddDate(0, 0, -reminderDays)
		notifyDateStr := notifyDate.Format("2006-01-02")

		log.Printf("   👉 Cek ID %d (%s): Wajib Tgl %s | Jam %s", id, personName, notifyDateStr, reminderTime)

		if notifyDateStr == todayStr && reminderTime == currentTimeStr {

			amtStr := "Rp" + formatRupiah(amount)
			dateStr := formatDateIndo(*dueDate)
			var title, body string

			if dtype == "HUTANG" {
				switch reminderDays {
				case 0:
					title = "JATUH TEMPO HARI INI! ⚠️"
					body = fmt.Sprintf("Darurat! Hutang ke %s sebesar %s jatuh tempo hari ini, %s. Segera lunasi ya! 🚨", personName, amtStr, dateStr)
				case 1:
					title = "Besok Jatuh Tempo ⏰"
					body = fmt.Sprintf("Siapkan dana! Besok (%s) kamu harus bayar %s ke %s.", dateStr, amtStr, personName)
				case 3:
					title = "Pengingat H-3 📅"
					body = fmt.Sprintf("Halo! 3 hari lagi (%s) ada jadwal bayar hutang ke %s sebesar %s.", dateStr, personName, amtStr)
				case 7:
					title = "Info Hutang Minggu Depan 🗓️"
					body = fmt.Sprintf("Sekedar info, minggu depan tanggal %s ada hutang ke %s sebesar %s.", dateStr, personName, amtStr)
				default:
					title = "Pengingat Hutang 🔔"
					body = fmt.Sprintf("Jangan lupa bayar hutang ke %s sebesar %s pada tanggal %s.", personName, amtStr, dateStr)
				}
			} else {
				switch reminderDays {
				case 0:
					title = "HARI INI CAIR! 🤑"
					body = fmt.Sprintf("Asik! Hari ini (%s) %s janji bayar hutang %s. Yuk tagih sekarang! 💸", dateStr, personName, amtStr)
				case 1:
					title = "Besok Ada Uang Masuk 💰"
					body = fmt.Sprintf("Siap-siap! Besok (%s) %s jatuh tempo bayar %s ke kamu.", dateStr, personName, amtStr)
				case 3:
					title = "3 Hari Lagi Cuan 📅 "
					body = fmt.Sprintf("3 hari lagi (%s), %s bakal bayar hutang %s ke kamu.", dateStr, personName, amtStr)
				case 7:
					title = "Info Piutang 🗓️"
					body = fmt.Sprintf("Minggu depan tanggal %s, %s punya jadwal bayar hutang %s ke kamu.", dateStr, personName, amtStr)
				default:
					title = "Pengingat Piutang 💰"
					body = fmt.Sprintf("Ingatkan %s untuk bayar %s pada tanggal %s.", personName, amtStr, dateStr)
				}
			}

			go utils.SendPushNotification(userID, title, body, "debt_reminder", "/debts")

			log.Printf("   ✅ NOTIF DIKIRIM ke User %d: %s", userID, title)
		}
	}

	if count == 0 {
		log.Println("   ⚠️ Tidak ada data hutang yang berstatus BELUM_LUNAS.")
	}
}
