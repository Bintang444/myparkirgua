# Sistem Parkir IoT

Sistem parkir berbasis Web + IoT menggunakan:

- 🌐 Frontend: Vanilla JavaScript (MVC Pattern)
- 🔥 Backend: Supabase (PostgreSQL)
- 📡 Real-time: MQTT
- 💳 Input: RFID (ESP32)
- 📊 Dashboard: Petugas & Owner

---

## ✨ Fitur Utama

### 🟢 Kendaraan Masuk
- Scan RFID
- Data tersimpan otomatis ke Supabase
- Palang terbuka via MQTT
- LCD menampilkan pesan masuk

### 🔴 Kendaraan Keluar
- Scan RFID atau tombol manual
- Hitung durasi otomatis
- Hitung biaya otomatis (dibulatkan per jam)
- Status: IN → OUT → DONE
- Sinkronisasi real-time ke dashboard

### 📊 Dashboard Petugas
- Monitoring kendaraan parkir
- Estimasi biaya real-time
- Konfirmasi keluar
- Grafik kendaraan harian

### 📈 Dashboard Owner
- Riwayat transaksi
- Statistik kendaraan
- Total pemasukan

---

## 🧠 Arsitektur

Project ini menggunakan pola:

```
View → Controller → Model → Supabase
                 ↘ MQTT ↙
```

Semua business logic dipusatkan di Controller untuk menjaga konsistensi.

---

## 🗂 Struktur Folder

```
assets/        → CSS, gambar
views/         → UI layer
controllers/   → Business logic
models/        → Database layer
config/        → Konfigurasi Supabase & MQTT
utils/         → Helper functions
```

---

## ⚙️ Teknologi

- Supabase (PostgreSQL + Realtime)
- MQTT via WebSocket
- Vanilla JavaScript (ES6 Modules)

---

## 📌 Status Project

✅ Motor Only Version  
🔄 Ready for refactor to multi-vehicle  
🚀 Siap dikembangkan lebih lanjut

## 🗃️ Skema Database (Sesuai soal UKK)
Tabel `transaksi`:
- `id` (integer, pk)
- `card_id` (text)
- `checkin_time` (timestamp)
- `checkout_time` (timestamp)
- `duration` (integer, menit)
- `fee` (integer, rupiah)
- `status` (text: IN/OUT/DONE)

## ▶️ Cara Jalankan
1. Buka `index.html` dengan Live Server atau `npx serve`.
2. Login user `petugas`/`owner`.
3. Petugas: scan RFID (`card_id`) untuk check-in/check-out.
4. Owner: lihat laporan dan ekspor CSV.

---
 
## 👨‍💻 Developer

**Bintang Eka Wardhana Syarifudin**  
Software Engineering Student  

---

## 📷 Preview

-


---

## 📜 License

Project ini dibuat untuk UKK & pengembangan portofolio.
