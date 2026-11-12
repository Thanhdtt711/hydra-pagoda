/**
 * Lớp truy cập CSDL thống nhất:
 * - Khi có `DATABASE_URL` / `NUXT_DATABASE_URL`: kết nối PostgreSQL (Supabase Pooler).
 * - Khi để trống: fallback dùng SQLite cục bộ (`node:sqlite`, giữ nguyên khả năng chạy offline & test).
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import pg from 'pg'
import { MIGRATIONS, toPostgresSql } from '../../db/migrations.ts'
import { getWalletConfig } from './config.ts'

export interface RunResult {
  changes: number
  lastInsertRowid: number
}

export interface DbStmt {
  get<T = Record<string, unknown>>(...params: unknown[]): Promise<T | undefined>
  all<T = Record<string, unknown>>(...params: unknown[]): Promise<T[]>
  run(...params: unknown[]): Promise<RunResult>
}

export interface DbConn {
  prepare(sql: string): DbStmt
  exec(sql: string): Promise<void>
}

// Đảm bảo BIGINT (int8, OID 20) và NUMERIC/SUM (OID 1700) trả về number thay vì string trong node-postgres
pg.types.setTypeParser(20, (val: string) => Number(val))
pg.types.setTypeParser(1700, (val: string) => Number(val))

const TABLES_WITH_ID = new Set([
  'accounts',
  'mc_ledger',
  'account_inventory',
  'fortune_records',
  'merit_donations',
  'meditation_sessions',
  'hau_dong_donations',
  'hau_dong_attendance',
  'parkour_records',
  'card_inventory',
  'card_pack_openings'
])

/** Chuyển placeholder `?` sang `$1, $2, ...` cho PostgreSQL (bỏ qua `?` trong chuỗi `'...'`). */
function convertPlaceholders(sql: string): string {
  let out = ''
  let idx = 1
  let inSingleQuote = false
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "'") {
      if (inSingleQuote && sql[i + 1] === "'") {
        out += "''"
        i++
        continue
      }
      inSingleQuote = !inSingleQuote
      out += ch
    } else if (ch === '?' && !inSingleQuote) {
      out += `$${idx++}`
    } else {
      out += ch
    }
  }
  return out
}

function appendReturningIdIfNeeded(sql: string): string {
  if (/\bRETURNING\b/i.test(sql)) return sql
  const m = sql.match(/^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i)
  if (m && TABLES_WITH_ID.has(m[1].toLowerCase())) {
    return `${sql.replace(/;\s*$/, '')} RETURNING id`
  }
  return sql
}

type Queryable = pg.Pool | pg.PoolClient

class PgConn implements DbConn {
  constructor(private readonly client: Queryable) {}

  prepare(sql: string): DbStmt {
    const pgSql = convertPlaceholders(sql)
    return {
      get: async <T = Record<string, unknown>>(...params: unknown[]): Promise<T | undefined> => {
        const res = await this.client.query(pgSql, params)
        return (res.rows[0] as T | undefined) ?? undefined
      },
      all: async <T = Record<string, unknown>>(...params: unknown[]): Promise<T[]> => {
        const res = await this.client.query(pgSql, params)
        return res.rows as T[]
      },
      run: async (...params: unknown[]): Promise<RunResult> => {
        const execSql = appendReturningIdIfNeeded(pgSql)
        const res = await this.client.query(execSql, params)
        const insertedId = res.rows?.[0]?.id
        return {
          changes: res.rowCount ?? 0,
          lastInsertRowid: insertedId != null ? Number(insertedId) : 0
        }
      }
    }
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql)
  }
}

class SqliteConn implements DbConn {
  constructor(private readonly raw: DatabaseSync) {}

  prepare(sql: string): DbStmt {
    const stmt = this.raw.prepare(sql)
    return {
      get: async <T = Record<string, unknown>>(...params: unknown[]): Promise<T | undefined> => {
        return stmt.get(...(params as any[])) as T | undefined
      },
      all: async <T = Record<string, unknown>>(...params: unknown[]): Promise<T[]> => {
        return stmt.all(...(params as any[])) as T[]
      },
      run: async (...params: unknown[]): Promise<RunResult> => {
        const res = stmt.run(...(params as any[]))
        return {
          changes: Number(res.changes ?? 0),
          lastInsertRowid: Number(res.lastInsertRowid ?? 0)
        }
      }
    }
  }

  async exec(sql: string): Promise<void> {
    this.raw.exec(sql)
  }
}

const txStorage = new AsyncLocalStorage<DbConn>()

let pgPool: pg.Pool | null = null
let pgReadyPromise: Promise<DbConn> | null = null
let pgUrlCache = ''

let sqliteRaw: DatabaseSync | null = null
let sqliteConn: SqliteConn | null = null
let sqliteTxChain: Promise<void> = Promise.resolve()

function runSqliteMigrations(conn: DatabaseSync) {
  conn.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)')
  const applied = new Set(
    (conn.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(r => r.version)
  )
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue
    conn.exec('BEGIN IMMEDIATE')
    try {
      conn.exec(m.sql)
      conn.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, Date.now())
      conn.exec('COMMIT')
      console.log(`[db:sqlite] đã áp dụng migration ${m.version} (${m.name})`)
    } catch (e) {
      conn.exec('ROLLBACK')
      throw e
    }
  }
}

async function runPgMigrations(pool: pg.Pool) {
  const client = await pool.connect()
  try {
    // Khóa tư vấn tránh đua migration nếu nhiều worker khởi động cùng lúc
    await client.query('SELECT pg_advisory_lock(8181001)')
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version BIGINT PRIMARY KEY, name TEXT NOT NULL, applied_at BIGINT NOT NULL)'
    )
    const appliedRes = await client.query('SELECT version FROM schema_migrations')
    const applied = new Set(appliedRes.rows.map(r => Number(r.version)))
    for (const m of MIGRATIONS) {
      if (applied.has(m.version)) continue
      await client.query('BEGIN')
      try {
        await client.query(toPostgresSql(m.sql))
        await client.query(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)',
          [m.version, m.name, Date.now()]
        )
        await client.query('COMMIT')
        console.log(`[db:pg] đã áp dụng migration ${m.version} (${m.name})`)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(8181001)') } catch { /* ignore */ }
    client.release()
  }
}

async function ensurePgPool(databaseUrl: string): Promise<DbConn> {
  if (pgReadyPromise && pgUrlCache === databaseUrl) {
    return pgReadyPromise
  }
  pgUrlCache = databaseUrl
  pgReadyPromise = (async () => {
    const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/i.test(databaseUrl) || /sslmode=disable/i.test(databaseUrl)
    pgPool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000
    })
    await runPgMigrations(pgPool)
    return new PgConn(pgPool)
  })().catch((err) => {
    pgReadyPromise = null
    throw err
  })
  return pgReadyPromise
}

/** Lấy kết nối CSDL (tự động chọn PostgreSQL nếu có `DATABASE_URL`, ngược lại dùng SQLite). */
export async function getDb(): Promise<DbConn> {
  const activeTx = txStorage.getStore()
  if (activeTx) return activeTx

  const cfg = getWalletConfig()
  if (cfg.databaseUrl) {
    return ensurePgPool(cfg.databaseUrl)
  }

  if (sqliteRaw && sqliteConn) {
    runSqliteMigrations(sqliteRaw)
    return sqliteConn
  }
  const file = resolve(cfg.dbPath)
  mkdirSync(dirname(file), { recursive: true })
  const raw = new DatabaseSync(file)
  raw.exec('PRAGMA journal_mode = WAL')
  raw.exec('PRAGMA foreign_keys = ON')
  raw.exec('PRAGMA busy_timeout = 5000')
  runSqliteMigrations(raw)
  sqliteRaw = raw
  sqliteConn = new SqliteConn(raw)
  return sqliteConn
}

/**
 * Chạy `fn` trong transaction nguyên tử (hỗ trợ lồng nhau qua AsyncLocalStorage).
 * - PostgreSQL: mở PoolClient riêng với BEGIN / COMMIT / ROLLBACK.
 * - SQLite: xếp hàng tuần tự transaction ngoài với BEGIN IMMEDIATE.
 */
export async function withTransaction<T>(fn: (conn: DbConn) => Promise<T> | T): Promise<T> {
  const existing = txStorage.getStore()
  if (existing) {
    return fn(existing)
  }

  const cfg = getWalletConfig()
  if (cfg.databaseUrl) {
    await ensurePgPool(cfg.databaseUrl)
    const client = await pgPool!.connect()
    const conn = new PgConn(client)
    try {
      await client.query('BEGIN')
      const result = await txStorage.run(conn, () => fn(conn))
      await client.query('COMMIT')
      return result
    } catch (e) {
      try { await client.query('ROLLBACK') } catch { /* ignore */ }
      throw e
    } finally {
      client.release()
    }
  }

  const conn = await getDb()
  const prev = sqliteTxChain
  let release!: () => void
  sqliteTxChain = new Promise<void>(r => { release = r })
  await prev
  try {
    await conn.exec('BEGIN IMMEDIATE')
    try {
      const result = await txStorage.run(conn, () => fn(conn))
      await conn.exec('COMMIT')
      return result
    } catch (e) {
      try { await conn.exec('ROLLBACK') } catch { /* ignore */ }
      throw e
    }
  } finally {
    release()
  }
}
