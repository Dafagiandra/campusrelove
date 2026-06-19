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
