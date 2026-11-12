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

/** Chuyển DDL SQLite trong MIGRATIONS sang cú pháp PostgreSQL tương đương. */
export function toPostgresSql(sqliteSql: string): string {
  return sqliteSql
    .replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'BIGSERIAL PRIMARY KEY')
    .replace(/\bINTEGER\b/gi, 'BIGINT')
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
  },
  {
    version: 4,
    name: 'hydra_l2_ledger_proof',
    sql: `
-- Bằng chứng Hydra L2 cho từng bút toán MC (Hybrid: SQLite vẫn là nguồn sự thật, Hydra là lớp chứng thực UTxO).
-- hydra_status: 'offchain' (chỉ SQLite) | 'submitted' (đã NewTx) | 'valid' (TxValid) | 'snapshot_confirmed' (SnapshotConfirmed)
ALTER TABLE mc_ledger ADD COLUMN hydra_tx_hash TEXT;
ALTER TABLE mc_ledger ADD COLUMN hydra_snapshot_no INTEGER;
ALTER TABLE mc_ledger ADD COLUMN hydra_status TEXT DEFAULT 'offchain';
CREATE INDEX mc_ledger_hydra_tx_idx ON mc_ledger (hydra_tx_hash);
CREATE INDEX mc_ledger_hydra_status_idx ON mc_ledger (hydra_status);

-- Khóa phiên L2 (Session Ephemeral Key): chỉ lưu public key + địa chỉ L2; private key được dẫn xuất tất định
-- từ bí mật máy chủ (hydra_kv) nên KHÔNG bao giờ nằm trong CSDL hay gửi xuống client.
ALTER TABLE accounts ADD COLUMN l2_session_vkey TEXT;
ALTER TABLE accounts ADD COLUMN l2_address TEXT;

-- Kho key-value nhỏ cho module Hydra (bí mật dẫn xuất khóa phiên, ...).
CREATE TABLE hydra_kv (
k TEXT PRIMARY KEY,
v TEXT NOT NULL,
updated_at INTEGER NOT NULL
);
`
  },
  {
    version: 5,
    name: 'meditation_sessions',
    sql: `
-- Phiên Tọa Thiền Nhận MC (Meditate-to-Earn): server giữ đồng hồ để chống tua giờ trình duyệt.
-- slot_id: mã bồ đoàn (HallLayout) đang giữ, dùng để các người chơi không ngồi trùng một chỗ.
-- status: 'active' (đang thiền) | 'completed' (đã nhận thưởng) | 'cancelled' (xả thiền sớm / bị thay bởi phiên mới)
CREATE TABLE meditation_sessions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token      TEXT    NOT NULL UNIQUE,
  account_id         INTEGER NOT NULL REFERENCES accounts(id),
  slot_id            INTEGER,
  duration_min       INTEGER NOT NULL CHECK (duration_min > 0),
  duration_sec       INTEGER NOT NULL CHECK (duration_sec > 0),
  expected_reward_mc INTEGER NOT NULL CHECK (expected_reward_mc >= 0),
  credited_mc        INTEGER NOT NULL DEFAULT 0 CHECK (credited_mc >= 0),
  status             TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  day_key            TEXT    NOT NULL,
  started_at         INTEGER NOT NULL,
  completed_at       INTEGER,
  ledger_id          INTEGER REFERENCES mc_ledger(id)
);
CREATE INDEX meditation_sessions_account_day_idx ON meditation_sessions (account_id, day_key, status);
CREATE INDEX meditation_sessions_slot_idx ON meditation_sessions (status, slot_id);
`
  },
  {
    version: 6,
    name: 'hau_dong_sanctuary_tables',
    sql: `
-- Phiên Hầu Đồng (8 phút = 480s, 5 Giá x 96s): Lịch cố định Mồng 1/Rằm Âm lịch, Mở đàn Đặc cách 2,500 MC hoặc Cộng dồn Bách Gia.
CREATE TABLE hau_dong_sessions (
  session_id           TEXT    PRIMARY KEY,
  trigger_type         TEXT    NOT NULL CHECK (trigger_type IN ('scheduled_lunar', 'sponsored_single', 'sponsored_crowdfund', 'inaugural_welcome')),
  sponsor_account_id   INTEGER REFERENCES accounts(id),
  sponsor_display_name TEXT    NOT NULL,
  prayer_text          TEXT    NOT NULL,
  deities_json         TEXT    NOT NULL,
  total_pool_mc        INTEGER NOT NULL DEFAULT 1500 CHECK (total_pool_mc >= 0),
  remaining_pool_mc    INTEGER NOT NULL DEFAULT 1500 CHECK (remaining_pool_mc >= 0),
  burned_mc            INTEGER NOT NULL DEFAULT 0 CHECK (burned_mc >= 0),
  reserve_mc           INTEGER NOT NULL DEFAULT 0 CHECK (reserve_mc >= 0),
  status               TEXT    NOT NULL CHECK (status IN ('queued', 'active', 'completed')),
  started_at           INTEGER,
  ends_at              INTEGER,
  created_at           INTEGER NOT NULL
);
CREATE INDEX hau_dong_sessions_status_idx ON hau_dong_sessions (status, created_at ASC);

-- Lịch sử công đức mở đàn Hầu Đồng (Mở đàn riêng >= 2,500 MC hoặc Cộng dồn Bách Gia >= 50 MC).
CREATE TABLE hau_dong_donations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id      TEXT    NOT NULL UNIQUE,
  account_id      INTEGER NOT NULL REFERENCES accounts(id),
  session_id      TEXT,
  mode            TEXT    NOT NULL CHECK (mode IN ('single_open', 'crowdfund')),
  amount_mc       INTEGER NOT NULL CHECK (amount_mc > 0),
  custom_deity_id TEXT,
  prayer_text     TEXT    NOT NULL,
  ledger_id       INTEGER REFERENCES mc_ledger(id),
  created_at      INTEGER NOT NULL
);
CREATE INDEX hau_dong_donations_account_idx ON hau_dong_donations (account_id, created_at DESC);
CREATE INDEX hau_dong_donations_mode_idx ON hau_dong_donations (mode, session_id);

-- Điểm danh hiện diện (Proximity Heartbeat) & Nhận Lộc (Ban Lễ) từng Giá đồng (1..5).
CREATE TABLE hau_dong_attendance (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id        TEXT    NOT NULL REFERENCES hau_dong_sessions(session_id),
  gia_index         INTEGER NOT NULL CHECK (gia_index BETWEEN 1 AND 5),
  account_id        INTEGER NOT NULL REFERENCES accounts(id),
  watch_seconds     INTEGER NOT NULL DEFAULT 0 CHECK (watch_seconds >= 0),
  is_bowing         INTEGER NOT NULL DEFAULT 0 CHECK (is_bowing IN (0, 1)),
  claimed_mc        INTEGER NOT NULL DEFAULT 0 CHECK (claimed_mc >= 0),
  ledger_id         INTEGER REFERENCES mc_ledger(id),
  last_heartbeat_at INTEGER NOT NULL,
  claimed_at        INTEGER,
  UNIQUE(session_id, gia_index, account_id)
);
CREATE INDEX hau_dong_attendance_account_idx ON hau_dong_attendance (account_id, claimed_at DESC);
`
  },
  {
    version: 7,
    name: 'parkour_mountain_challenge',
    sql: `
-- Thử thách Parkour Leo Núi Phía Sau Chùa (Đường Lên Đỉnh Phù Vân)
CREATE TABLE parkour_records (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id       INTEGER NOT NULL REFERENCES accounts(id),
  day_key          TEXT    NOT NULL, -- YYYY-MM-DD
  attempts_count   INTEGER NOT NULL DEFAULT 0 CHECK (attempts_count >= 0),
  has_free_claimed INTEGER NOT NULL DEFAULT 0 CHECK (has_free_claimed IN (0, 1)),
  completed_count  INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
  best_time_sec    INTEGER CHECK (best_time_sec > 0),
  updated_at       INTEGER NOT NULL,
  UNIQUE(account_id, day_key)
);
CREATE INDEX parkour_records_acc_day_idx ON parkour_records (account_id, day_key);

CREATE TABLE parkour_runs (
  run_token        TEXT    PRIMARY KEY,
  account_id       INTEGER NOT NULL REFERENCES accounts(id),
  day_key          TEXT    NOT NULL,
  fee_mc           INTEGER NOT NULL DEFAULT 0 CHECK (fee_mc >= 0),
  grant_mc         INTEGER NOT NULL DEFAULT 0 CHECK (grant_mc >= 0),
  started_at       INTEGER NOT NULL,
  completed_at     INTEGER,
  time_taken_sec   INTEGER,
  reward_mc        INTEGER NOT NULL DEFAULT 0 CHECK (reward_mc >= 0),
  ledger_id        INTEGER REFERENCES mc_ledger(id)
);
CREATE INDEX parkour_runs_account_idx ON parkour_runs (account_id, started_at DESC);
`
  },
  {
    version: 8,
    name: 'fortune_records_relax_constraints',
    sql: `
-- Tái cấu trúc fortune_records: cho phép tier đa dạng ('free_daily', 'offering_*', 'basic', 'auspicious', 'golden'),
-- cho phép cost_mc = 0 (lượt miễn phí trong ngày / dâng lễ phẩm),
-- và mở rộng category ('love_couple', v.v.)
CREATE TABLE fortune_records_v8 (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL REFERENCES accounts(id),
  request_id    TEXT    NOT NULL UNIQUE,
  category      TEXT    NOT NULL,
  tier          TEXT    NOT NULL,
  cost_mc       INTEGER NOT NULL DEFAULT 0 CHECK (cost_mc >= 0),
  fortune_json  TEXT    NOT NULL,
  receipt_hash  TEXT    NOT NULL,
  created_at    INTEGER NOT NULL
);

INSERT INTO fortune_records_v8 (id, account_id, request_id, category, tier, cost_mc, fortune_json, receipt_hash, created_at)
  SELECT id, account_id, request_id, category, tier, cost_mc, fortune_json, receipt_hash, created_at FROM fortune_records;

DROP TABLE fortune_records;

ALTER TABLE fortune_records_v8 RENAME TO fortune_records;

CREATE INDEX fortune_records_account_idx ON fortune_records (account_id, created_at DESC);
`
  },
  {
    version: 9,
    name: 'heritage_card_inventory_and_gacha',
    sql: `
-- Kho Thẻ Bài Di Sản Cổ Tự & Kinh Kệ Gacha (Monetization & Card Collection)
CREATE TABLE IF NOT EXISTS card_inventory (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL REFERENCES accounts(id),
  card_id       TEXT    NOT NULL,
  rarity        TEXT    NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  unlocked_at   INTEGER NOT NULL,
  is_nft_minted INTEGER DEFAULT 0 CHECK (is_nft_minted IN (0, 1)),
  nft_asset_id  TEXT
);
CREATE INDEX IF NOT EXISTS idx_card_inv_acc ON card_inventory (account_id, unlocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_inv_card ON card_inventory (card_id);

-- Lịch sử mở gói thẻ Gacha Pack
CREATE TABLE IF NOT EXISTS card_pack_openings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   INTEGER NOT NULL REFERENCES accounts(id),
  request_id   TEXT    NOT NULL UNIQUE,
  pack_id      TEXT    NOT NULL,
  cost_mc      INTEGER NOT NULL CHECK (cost_mc > 0),
  card_ids     TEXT    NOT NULL,
  cards_json   TEXT    NOT NULL,
  receipt_hash TEXT    NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_card_pack_acc ON card_pack_openings (account_id, created_at DESC);
`
  },
  {
    version: 10,
    name: 'accounts_fortune_name',
    sql: `
-- Lưu họ tên từ hồ sơ Bói Quẻ (nếu người chơi đã nhập) để hiển thị trong game & multiplayer,
-- tách biệt với display_name mặc định theo ví để có thể khôi phục khi xóa hồ sơ.
ALTER TABLE accounts ADD COLUMN fortune_name TEXT;
`
  },
  {
    version: 11,
    name: 'account_streaks_and_rewards',
    sql: `
-- Sổ Tu Tập: chuỗi ngày an lạc của từng tài khoản. Ngày tính theo giờ Việt Nam (YYYY-MM-DD).
-- rest_week_key: khóa tuần (thứ Hai) đã dùng "ngày nghỉ" bảo vệ chuỗi, mỗi tuần dùng tối đa một lần.
-- title: danh hiệu mở ở cột mốc cuối (hiển thị cạnh tên).
CREATE TABLE account_streaks (
  account_id     INTEGER PRIMARY KEY REFERENCES accounts(id),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak    INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  last_day_key   TEXT,
  rest_week_key  TEXT,
  title          TEXT,
  updated_at     INTEGER NOT NULL
);

-- Mỗi cột mốc chỉ phát thưởng một lần cho mỗi tài khoản (chuỗi về nửa rồi lên lại không phát lại).
CREATE TABLE streak_rewards (
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  milestone  INTEGER NOT NULL CHECK (milestone > 0),
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, milestone)
);
`
  },
  {
    version: 12,
    name: 'daily_deeds_and_rewards',
    sql: `
-- Ba Việc Lành mỗi ngày: chỉ lưu việc "đến điểm" đã hoàn thành. Việc thiền, thắp hương, gieo quẻ tự tính từ
-- các bảng sẵn có nên không cần lưu. Ngày theo giờ Việt Nam (YYYY-MM-DD).
CREATE TABLE daily_deeds (
  account_id   INTEGER NOT NULL REFERENCES accounts(id),
  day_key      TEXT    NOT NULL,
  deed_id      TEXT    NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, day_key, deed_id)
);

-- Mỗi tài khoản nhận quà đủ ba việc tối đa một lần mỗi ngày.
CREATE TABLE daily_deed_rewards (
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  day_key    TEXT    NOT NULL,
  item_id    TEXT    NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, day_key)
);
`
  }
]
