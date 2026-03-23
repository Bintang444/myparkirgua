-- ============================================================
-- DATABASE SCHEMA: Sistem Parkir Pintar Berbasis IoT
-- Project  : myparkirgua
-- Author   : Bintang Eka Wardhana Syarifudin
-- NIS      : 2324.10.387
-- Sekolah  : SMK Mahardhika Batujajar
-- T.P.     : 2025/2026
-- ============================================================


-- ------------------------------------------------------------
-- TABEL: profiles
-- Menyimpan data pengguna dashboard beserta role-nya.
-- Tabel ini dikelola oleh Supabase Auth dan di-extend
-- dengan kolom tambahan (nama, role).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY,           -- UUID dari Supabase Auth (auth.users.id)
    email       TEXT NOT NULL UNIQUE,       -- Email login pengguna
    nama        TEXT NOT NULL,              -- Nama lengkap pengguna
    role        TEXT NOT NULL               -- Role: 'petugas' atau 'owner'
                CHECK (role IN ('petugas', 'owner')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ------------------------------------------------------------
-- TABEL: transaksi
-- Menyimpan seluruh data transaksi parkir kendaraan.
-- Setiap baris mewakili satu sesi parkir dari check-in
-- hingga check-out dan konfirmasi oleh petugas.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaksi (
    id              SERIAL PRIMARY KEY,                 -- ID transaksi (auto increment)
    card_id         TEXT NOT NULL,                      -- UID kartu RFID kendaraan
    checkin_time    TIMESTAMP WITH TIME ZONE NOT NULL,  -- Waktu kendaraan masuk (check-in)
    checkout_time   TIMESTAMP WITH TIME ZONE,           -- Waktu kendaraan keluar (check-out), NULL saat masih parkir
    duration        INTEGER,                            -- Durasi parkir dalam menit, NULL saat masih parkir
    fee             INTEGER,                            -- Total biaya parkir dalam rupiah, NULL saat masih parkir
    status          TEXT NOT NULL DEFAULT 'IN'          -- Status transaksi
                    CHECK (status IN ('IN', 'OUT', 'DONE')),
    petugas_masuk   TEXT,                               -- Nama petugas yang mencatat masuk
    petugas_keluar  TEXT                                -- Nama petugas yang mengkonfirmasi keluar
);


-- ------------------------------------------------------------
-- DUMMY DATA: profiles
-- 
-- BACA SEBELUM IMPORT:
-- Jangan langsung jalankan INSERT ini!
-- 
-- URUTAN YANG BENAR:
-- 1. Buat user di Supabase Dashboard → Authentication → Users → Add User
--    - owner@test.com  / password bebas
--    - petugas@test.com / password bebas
-- 2. Setelah dibuat, copy UUID masing-masing user dari kolom "UID"
-- 3. Ganti UUID di bawah ini dengan UUID asli dari Supabase Auth
-- 4. Baru jalankan INSERT ini di SQL Editor
--
-- Kalau urutan terbalik (INSERT dulu baru buat user di Auth),
-- UUID tidak akan cocok dan login akan selalu gagal!
-- ------------------------------------------------------------
INSERT INTO profiles (id, email, nama, role) VALUES
(
    'GANTI-DENGAN-UUID-OWNER-DARI-SUPABASE-AUTH',   -- UUID dari Authentication > Users
    'owner@test.com',
    'Owner Parkir',
    'owner'
),
(
    'GANTI-DENGAN-UUID-PETUGAS-DARI-SUPABASE-AUTH', -- UUID dari Authentication > Users
    'petugas@test.com',
    'Petugas Parkir',
    'petugas'
);


-- ------------------------------------------------------------
-- DUMMY DATA: transaksi
-- Data transaksi contoh untuk pengujian dashboard
-- ------------------------------------------------------------
INSERT INTO transaksi (id, card_id, checkin_time, checkout_time, duration, fee, status, petugas_keluar) VALUES
(1, 'A1B2C3D4', '2026-03-17 08:00:00+07', '2026-03-17 10:00:00+07', 120, 4000,  'DONE', 'Petugas Parkir'),
(2, 'E5F6G7H8', '2026-03-17 09:30:00+07', NULL,                     NULL, NULL,  'IN',   NULL),
(3, 'I9J0K1L2', '2026-03-17 10:15:00+07', '2026-03-17 10:45:00+07', 30,   2000,  'OUT',  NULL);