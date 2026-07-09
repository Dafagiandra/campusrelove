-- ============================================================
--  MIGRATION: Fitur Penarikan Saldo
--  Jalankan di phpMyAdmin: USE preloved_db; lalu paste ini
-- ============================================================

USE preloved_db;

-- 1. Tambah kolom rekening tersimpan ke tabel users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS saved_bank_name    VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS saved_bank_account VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS saved_bank_owner   VARCHAR(100) DEFAULT NULL;

-- 2. Buat tabel pengajuan penarikan
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  seller_id       VARCHAR(36)   NOT NULL,
  seller_name     VARCHAR(100),
  amount          DECIMAL(15,2) NOT NULL,
  bank_name       VARCHAR(100)  NOT NULL,
  account_number  VARCHAR(50)   NOT NULL,
  account_name    VARCHAR(100)  NOT NULL,
  name_mismatch   TINYINT(1)    NOT NULL DEFAULT 0,
  status          ENUM('pending','completed','rejected') NOT NULL DEFAULT 'pending',
  admin_note      TEXT,
  processed_at    DATETIME,
  created_at      DATETIME      NOT NULL DEFAULT NOW(),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Selesai! Restart backend server setelah menjalankan ini.
