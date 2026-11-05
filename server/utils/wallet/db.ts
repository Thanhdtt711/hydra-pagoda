/**
 * Kết nối SQLite (node:sqlite có sẵn trong Node >= 22.5, không cần build native).
 * Một kết nối dùng chung cho cả tiến trình; WAL cho phép đọc song song khi ghi.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { MIGRATIONS } from '../../db/migrations'
import { getWalletConfig } from './config'

let db: DatabaseSync | null = null

/** Lấy (và khởi tạo lười) kết nối CSDL, tự chạy migration còn thiếu. */
export function getDb(): DatabaseSync {
  if (db) return db
  const file = resolve(getWalletConfig().dbPath)
  mkdirSync(dirname(file), { recursive: true })
  const conn = new DatabaseSync(file)
  conn.exec('PRAGMA journal_mode = WAL')
  conn.exec('PRAGMA foreign_keys = ON')
  // Đợi tối đa 5s nếu có tiến trình khác đang khóa ghi thay vì lỗi SQLITE_BUSY ngay.
  conn.exec('PRAGMA busy_timeout = 5000')
  runMigrations(conn)
  db = conn
  return conn
}

function runMigrations(conn: DatabaseSync) {
  conn.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)')
  const applied = new Set(
    (conn.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(r => r.version)
  )
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue
    // Mỗi migration trong một transaction: lỗi giữa chừng sẽ rollback, không để schema nửa vời.
    conn.exec('BEGIN IMMEDIATE')
    try {
      conn.exec(m.sql)
      conn.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, Date.now())
      conn.exec('COMMIT')
      console.log(`[db] đã áp dụng migration ${m.version} (${m.name})`)
    } catch (e) {
      conn.exec('ROLLBACK')
      throw e
    }
  }
}

/**
 * Chạy `fn` trong một transaction ghi nguyên tử (BEGIN IMMEDIATE lấy khóa ghi ngay từ đầu
 * nên hai yêu cầu đua nhau sẽ được xếp hàng, không đọc-rồi-ghi trên số liệu cũ).
 */
export function withTransaction<T>(fn: (conn: DatabaseSync) => T): T {
  const conn = getDb()
  conn.exec('BEGIN IMMEDIATE')
  try {
    const result = fn(conn)
    conn.exec('COMMIT')
    return result
  } catch (e) {
    conn.exec('ROLLBACK')
    throw e
  }
}

