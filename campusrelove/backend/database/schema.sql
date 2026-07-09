-- ============================================================
--  PRELOVED DATABASE SCHEMA
--  Jalankan di phpMyAdmin atau MySQL client
--  CREATE DATABASE preloved_db; USE preloved_db;
-- ============================================================

CREATE DATABASE IF NOT EXISTS preloved_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE preloved_db;

-- ── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(150) NOT NULL UNIQUE,
  password         VARCHAR(255) NOT NULL,
  role             ENUM('buyer','seller','admin') NOT NULL DEFAULT 'buyer',
  city             VARCHAR(100),
  phone            VARCHAR(20),
  avatar           TEXT,
  balance          DECIMAL(15,2) NOT NULL DEFAULT 0,
  rating           DECIMAL(3,2)  NOT NULL DEFAULT 0,
  total_sales      INT           NOT NULL DEFAULT 0,
  verified         TINYINT(1)   NOT NULL DEFAULT 0,
  verification_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  ktp_photo        LONGTEXT,
  selfie_photo     LONGTEXT,
  rejection_note   TEXT,
  verification_date DATETIME,
  join_date        DATE         NOT NULL DEFAULT (CURDATE()),
  created_at       DATETIME     NOT NULL DEFAULT NOW(),
  updated_at       DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- ── PRODUCTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  title            VARCHAR(200) NOT NULL,
  description      TEXT,
  price            DECIMAL(15,2) NOT NULL,
  original_price   DECIMAL(15,2),
  category         VARCHAR(50),
  `condition`      VARCHAR(50),
  condition_score  INT DEFAULT 75,
  seller_id        VARCHAR(36)  NOT NULL,
  is_hot           TINYINT(1)   NOT NULL DEFAULT 0,
  is_new           TINYINT(1)   NOT NULL DEFAULT 0,
  is_almost_sold   TINYINT(1)   NOT NULL DEFAULT 0,
  views            INT          NOT NULL DEFAULT 0,
  tags             JSON,
  images           JSON,
  is_sold          TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       DATETIME     NOT NULL DEFAULT NOW(),
  updated_at       DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── ORDERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                   VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  buyer_id             VARCHAR(36) NOT NULL,
  buyer_name           VARCHAR(100),
  seller_id            VARCHAR(36) NOT NULL,
  product_id           VARCHAR(36) NOT NULL,
  product_title        VARCHAR(200),
  price                DECIMAL(15,2) NOT NULL,
  platform_fee_percent DECIMAL(5,2) DEFAULT 2,
  platform_fee         DECIMAL(15,2),
  seller_amount        DECIMAL(15,2),
  escrow_status        ENUM('holding','released','refunded') DEFAULT 'holding',
  status               ENUM('pending_payment','paid','processing','shipped','delivered','completed','cancelled') NOT NULL DEFAULT 'pending_payment',
  meetup_point         VARCHAR(200),
  resi                 VARCHAR(100),
  cod_schedule         VARCHAR(200),
  cancel_reason        TEXT,
  cancelled_by         ENUM('buyer','seller','admin'),
  rejection_note       TEXT,
  paid_at              DATETIME,
  processed_at         DATETIME,
  shipped_at           DATETIME,
  delivered_at         DATETIME,
  completed_at         DATETIME,
  cancelled_at         DATETIME,
  created_at           DATETIME NOT NULL DEFAULT NOW(),
  updated_at           DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (buyer_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  recipient_id VARCHAR(36)  NOT NULL,
  type         VARCHAR(50),
  message      TEXT         NOT NULL,
  order_id     VARCHAR(36),
  is_read      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT NOW(),
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── CHATS / CONVERSATIONS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  buyer_id        VARCHAR(36) NOT NULL,
  seller_id       VARCHAR(36) NOT NULL,
  product_id      VARCHAR(36) NOT NULL,
  product_title   VARCHAR(200),
  last_message_at DATETIME,
  created_at      DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY (buyer_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  conversation_id VARCHAR(36) NOT NULL,
  sender_id       VARCHAR(36) NOT NULL,
  text            TEXT        NOT NULL,
  is_read         TINYINT(1)  NOT NULL DEFAULT 0,
  sent_at         DATETIME    NOT NULL DEFAULT NOW(),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- ── ADMIN WALLET ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_wallet (
  id            VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  order_id      VARCHAR(36),
  product_title VARCHAR(200),
  amount        DECIMAL(15,2) NOT NULL,
  type          ENUM('platform_fee','refund','carry_fee') DEFAULT 'platform_fee',
  created_at    DATETIME NOT NULL DEFAULT NOW()
);

-- ── ADMIN ACCOUNT (default) ───────────────────────────────────────────────────
-- Password: admin123 (bcrypt hash)
INSERT IGNORE INTO users (id, name, email, password, role, verified, verification_status)
VALUES (
  'admin-001',
  'Admin Preloved',
  'admin@preloved.id',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- admin123
  'admin',
  1,
  'approved'
);

-- ── LISTING FEES (biaya tayang per kategori, diatur admin) ────────────────────
CREATE TABLE IF NOT EXISTS listing_fees (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  category    VARCHAR(50)   NOT NULL UNIQUE,
  price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration_days INT         NOT NULL DEFAULT 7,
  updated_at  DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- Default harga listing per kategori (admin bisa ubah dari dashboard)
INSERT IGNORE INTO listing_fees (category, price, duration_days) VALUES
  ('fashion',    5000,  7),
  ('electronic', 10000, 7),
  ('furniture',  10000, 7),
  ('hobi',       5000,  7),
  ('otomotif',   15000, 7),
  ('buku',       3000,  7),
  ('olahraga',   5000,  7),
  ('kesehatan',  5000,  7),
  ('dapur',      5000,  7),
  ('bayi',       5000,  7),
  ('lainnya',    3000,  7);

-- ── LISTING PAYMENTS (riwayat pembayaran listing oleh penjual) ────────────────
CREATE TABLE IF NOT EXISTS listing_payments (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  seller_id   VARCHAR(36)   NOT NULL,
  product_id  VARCHAR(36),                  -- NULL kalau bayar sebelum upload
  category    VARCHAR(50)   NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  status      ENUM('pending','paid','free') NOT NULL DEFAULT 'pending',
  notes       TEXT,
  created_at  DATETIME      NOT NULL DEFAULT NOW(),
  paid_at     DATETIME,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Tambah kolom listing_expires_at ke products ───────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS listing_expires_at DATETIME   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS listing_status     ENUM('active','expired','pending_payment') DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_free_listing    TINYINT(1) NOT NULL DEFAULT 0;

-- ── COMPLAINTS (komplain pembeli sebelum dana cair ke penjual) ────────────────
CREATE TABLE IF NOT EXISTS complaints (
  id            VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  order_id      VARCHAR(36)  NOT NULL,
  buyer_id      VARCHAR(36)  NOT NULL,
  seller_id     VARCHAR(36)  NOT NULL,
  reason        TEXT         NOT NULL,
  description   TEXT,
  status        ENUM('open','resolved_refund','resolved_release') DEFAULT 'open',
  admin_note    TEXT,
  resolved_at   DATETIME,
  created_at    DATETIME     NOT NULL DEFAULT NOW(),
  FOREIGN KEY (order_id)  REFERENCES orders(id)  ON DELETE CASCADE,
  FOREIGN KEY (buyer_id)  REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES users(id)   ON DELETE CASCADE
);

-- ── Tambah kolom OTP & KYC ke tabel users ────────────────────────────────────
-- Jalankan ini di phpMyAdmin jika tabel users sudah ada
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verified  TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_verified  TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at DATETIME  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_result      VARCHAR(100) DEFAULT NULL;

-- ── WITHDRAWAL REQUESTS (pengajuan penarikan saldo penjual) ──────────────────
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  seller_id       VARCHAR(36)   NOT NULL,
  seller_name     VARCHAR(100),
  amount          DECIMAL(15,2) NOT NULL,
  bank_name       VARCHAR(100)  NOT NULL,
  account_number  VARCHAR(50)   NOT NULL,
  account_name    VARCHAR(100)  NOT NULL,
  -- Apakah nama rekening berbeda dari nama akun seller (untuk peringatan admin)
  name_mismatch   TINYINT(1)    NOT NULL DEFAULT 0,
  status          ENUM('pending','completed','rejected') NOT NULL DEFAULT 'pending',
  admin_note      TEXT,
  processed_at    DATETIME,
  created_at      DATETIME      NOT NULL DEFAULT NOW(),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Tambah kolom saved_bank_account ke users (simpan rekening terakhir) ───────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS saved_bank_name    VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS saved_bank_account VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS saved_bank_owner   VARCHAR(100) DEFAULT NULL;
