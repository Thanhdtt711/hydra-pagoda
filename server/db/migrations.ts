/**
 * Migration SQL cho SQLite (đánh số tăng dần, chạy một lần mỗi phiên bản).
 * Viết SQL tương thích Postgres ở mức có thể (INTEGER cho số tiền, không dùng float)
 * để sau này chuyển Postgres chỉ cần đổi driver.
 * Nhúng trong TS (thay vì file .sql) để bundle Nitro không phải đọc đĩa lúc chạy.
 */
export interface Migration {
  version: number
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'auth_accounts_sessions',
    sql: `
CREATE TABLE accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Địa chỉ bech32 đã được CHỨNG MINH sở hữu bằng chữ ký CIP-8 (định danh duy nhất).
  address       TEXT    NOT NULL UNIQUE,
  display_name  TEXT    NOT NULL,
  -- Số dư MC (điểm trong game, off-chain). Số nguyên; không bao giờ âm (xem Bước 3-4).
  mc_balance    INTEGER NOT NULL DEFAULT 0 CHECK (mc_balance >= 0),
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

-- Nonce đăng nhập dùng một lần. Lưu cả message đã phát hành để server so khớp CHÍNH XÁC
-- thông điệp ví đã ký (client không thể đổi nội dung/domain/thời gian).
CREATE TABLE auth_nonces (
  nonce       TEXT    PRIMARY KEY,
  address     TEXT    NOT NULL,
  domain      TEXT    NOT NULL,
  message     TEXT    NOT NULL,
  issued_at   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);
CREATE INDEX auth_nonces_expires_idx ON auth_nonces (expires_at);

-- Phiên đăng nhập. Chỉ lưu SHA-256 của token (rò rỉ DB không làm lộ cookie hợp lệ).
CREATE TABLE sessions (
  token_hash  TEXT    PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_account_idx ON sessions (account_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- Vé WebSocket dùng một lần, sống ngắn: gắn kết nối WS với tài khoản đã xác thực
-- mà không đưa token phiên vào JS (cookie vẫn httpOnly).
CREATE TABLE ws_tickets (
  ticket_hash TEXT    PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id),
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);
CREATE INDEX ws_tickets_expires_idx ON ws_tickets (expires_at);
`
  },
  {
    version: 2,
    name: 'mc_orders_deposits_and_ledger',
    sql: `
-- Đơn mua MC coin bằng ADA (1 ADA = 1.000.000 lovelace = 1.000 MC).
-- Chỉ cộng MC sau khi giao dịch trên chuỗi đạt đủ số xác nhận (confirmations >= required).
CREATE TABLE mc_orders (
  order_id           TEXT    PRIMARY KEY,
  account_id         INTEGER NOT NULL REFERENCES accounts(id),
  address            TEXT    NOT NULL,
  treasury_address   TEXT    NOT NULL,
  expected_lovelace  INTEGER NOT NULL CHECK (expected_lovelace >= 2000000),
  expected_mc        INTEGER NOT NULL CHECK (expected_mc >= 2000),
  received_lovelace  INTEGER,
  credited_mc        INTEGER,
  unsigned_tx_hash   TEXT,
  unsigned_tx_cbor   TEXT,
  tx_hash            TEXT    UNIQUE,
  block_height       INTEGER,
  confirmations      INTEGER NOT NULL DEFAULT 0,
  status             TEXT    NOT NULL CHECK (status IN (
    'pending',
    'signing',
    'submitted',
    'confirming',
    'completed',
    'expired',
    'underpaid',
    'expired_paid',
    'failed'
  )),
  failure_reason     TEXT,
  created_at         INTEGER NOT NULL,
  expires_at         INTEGER NOT NULL,
  submitted_at       INTEGER,
  completed_at       INTEGER
);
CREATE INDEX mc_orders_account_idx ON mc_orders (account_id, created_at DESC);
CREATE INDEX mc_orders_status_idx ON mc_orders (status);

-- Bảng idempotency chống cộng trùng theo tx_hash (mẫu bridge_deposits từ hydra-graveyard).
-- Mỗi tx_hash trên chuỗi Cardano là PRIMARY KEY: INSERT ... ON CONFLICT(tx_hash) DO NOTHING
-- đảm bảo dù webhook hay polling gọi lặp bao nhiêu lần cũng chỉ xử lý ĐÚNG MỘT LẦN.
CREATE TABLE chain_deposits (
  tx_hash        TEXT    PRIMARY KEY,
  order_id       TEXT    REFERENCES mc_orders(order_id),
  account_id     INTEGER REFERENCES accounts(id),
  lovelace       INTEGER NOT NULL CHECK (lovelace > 0),
  mc_credited    INTEGER NOT NULL CHECK (mc_credited >= 0),
  block_height   INTEGER NOT NULL,
  confirmations  INTEGER NOT NULL,
  status         TEXT    NOT NULL CHECK (status IN ('credited', 'underpaid', 'expired_paid', 'unmatched')),
  note           TEXT,
  created_at     INTEGER NOT NULL
);
CREATE INDEX chain_deposits_status_idx ON chain_deposits (status);

-- Sổ cái bất biến (append-only ledger) cho mọi biến động số dư MC (+ nạp ADA, - tiêu trong game).
-- Ràng buộc UNIQUE(reason, ref_id) khóa chặt idempotency ở tầng CSDL.
CREATE TABLE mc_ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id     INTEGER NOT NULL REFERENCES accounts(id),
  delta_mc       INTEGER NOT NULL CHECK (delta_mc != 0),
  balance_after  INTEGER NOT NULL CHECK (balance_after >= 0),
  reason         TEXT    NOT NULL,
  ref_type       TEXT    NOT NULL,
  ref_id         TEXT    NOT NULL,
  tx_hash        TEXT,
  metadata_json  TEXT,
  created_at     INTEGER NOT NULL,
  UNIQUE(reason, ref_id)
);
CREATE INDEX mc_ledger_account_idx ON mc_ledger (account_id, created_at DESC);
`
  },
  {
    version: 3,
    name: 'mc_spend_inventory_fortune_merit',
    sql: `
-- Kho đồ & vật phẩm đã mở khóa của từng tài khoản (Cổ phục 9 nước, Lễ vật & Nhang trầm, Thẻ bài Di sản).
CREATE TABLE account_inventory (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   INTEGER NOT NULL REFERENCES accounts(id),
  item_id      TEXT    NOT NULL,
  category     TEXT    NOT NULL CHECK (category IN ('attire', 'offering', 'heritage_card')),
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unlocked_at  INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  UNIQUE(account_id, item_id)
);
CREATE INDEX account_inventory_account_idx ON account_inventory (account_id);

-- Lịch sử Bói Quẻ & Cầu An: kết quả sinh hoàn toàn ở server và gắn với request_id idempotent.
CREATE TABLE fortune_records (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL REFERENCES accounts(id),
  request_id    TEXT    NOT NULL UNIQUE,
  category      TEXT    NOT NULL CHECK (category IN ('stick', 'love', 'family', 'wealth', 'health', 'star')),
  tier          TEXT    NOT NULL CHECK (tier IN ('basic', 'auspicious', 'golden')),
  cost_mc       INTEGER NOT NULL CHECK (cost_mc > 0),
  fortune_json  TEXT    NOT NULL,
  receipt_hash  TEXT    NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX fortune_records_account_idx ON fortune_records (account_id, created_at DESC);

-- Lịch sử Cúng dường Hòm Công Đức: cộng vào tổng công đức toàn chùa và lưu bảng công đức.
CREATE TABLE merit_donations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id      INTEGER NOT NULL REFERENCES accounts(id),
  request_id      TEXT    NOT NULL UNIQUE,
  amount_mc       INTEGER NOT NULL CHECK (amount_mc > 0),
  prayer          TEXT    NOT NULL,
  reward_item_id  TEXT,
  receipt_hash    TEXT    NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX merit_donations_account_idx ON merit_donations (account_id, created_at DESC);
CREATE INDEX merit_donations_created_idx ON merit_donations (created_at DESC);
`
  }
]
