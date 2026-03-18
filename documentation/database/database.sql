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
    petugas_keluar  TEXT                                -- Nama petugas yang mengkonfirmasi keluar
);


-- ------------------------------------------------------------
-- DUMMY DATA: profiles
-- Data akun pengguna untuk pengujian sistem
-- ------------------------------------------------------------
INSERT INTO profiles (id, email, nama, role, created_at) VALUES
(
    '0a9e386a-ed14-42f7-a03d-be2b7591fe87',
    'owner@test.com',
    'Owner Parkir',
    'owner',
    '2026-02-09 01:18:33+00'
),
(
    'cb663b97-7a98-42f6-8da0-17c2909bbb9c',
    'petugas@test.com',
    'Petugas Parkir',
    'petugas',
    '2026-02-09 01:18:16+00'
);


-- ------------------------------------------------------------
-- DUMMY DATA: transaksi
-- Data transaksi contoh untuk pengujian dashboard
-- ------------------------------------------------------------
INSERT INTO transaksi (id, card_id, checkin_time, checkout_time, duration, fee, status, petugas_keluar) VALUES
(1, 'A1B2C3D4', '2026-03-17 08:00:00+07', '2026-03-17 10:00:00+07', 120, 4000,  'DONE', 'Petugas Parkir'),
(2, 'E5F6G7H8', '2026-03-17 09:30:00+07', NULL,                     NULL, NULL,  'IN',   NULL),
(3, 'I9J0K1L2', '2026-03-17 10:15:00+07', '2026-03-17 10:45:00+07', 30,   2000,  'OUT',  NULL);
