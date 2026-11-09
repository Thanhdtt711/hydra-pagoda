/**
 * Client đọc chuỗi Cardano qua Blockfrost REST API.
 *
 * NGUỒN GỐC TÁI DÙNG:
 * - D:\Vtechcom\hydra-graveyard\apps\graveyard-engine\src\bridge\blockfrost.client.ts
 *
 * Điều chỉnh cho Vạn Cảnh Thiền Tự (hydra-pagoda):
 * - Bổ sung `txInfo(txHash)` để đọc trực tiếp `block_height` và `block_time` của một `txHash` cụ thể
 *   (giúp đối chiếu nhanh đơn hàng đã biết `txHash` ngoài việc quét danh sách giao dịch tại `treasuryAddress`).
 * - Hỗ trợ tiêm (inject) `setBlockfrostClientForTest()` để chạy kiểm thử tự động các ca xác nhận,
 *   rollback, trả thiếu/thừa, đơn hết hạn mà không cần khóa API thật.
 */
import { getWalletConfig } from './config'

export interface BfAddressTx {
  txHash: string
  blockHeight: number
  blockTime: number
}

export interface BfTxInfo {
  txHash: string
  blockHeight: number
  blockTime: number
}

export interface BfTxIo {
  address: string
  lovelace: number
}

export interface BfTxUtxos {
  /** Chỉ tính các input thực sự chi tiêu (loại bỏ collateral và reference inputs) */
  inputs: BfTxIo[]
  outputs: BfTxIo[]
}

export interface BfTxMetadatum {
  label: string
  json: unknown
}

export interface BlockfrostClient {
  latestBlockHeight(): Promise<number>
  addressTransactions(address: string, opts?: { count?: number; page?: number; order?: 'asc' | 'desc' }): Promise<BfAddressTx[]>
  txInfo(txHash: string): Promise<BfTxInfo | null>
  txUtxos(txHash: string): Promise<BfTxUtxos | null>
  txExists(txHash: string): Promise<boolean>
  txMetadata(txHash: string): Promise<BfTxMetadatum[]>
}

interface BfAmount {
  unit: string
  quantity: string
}

interface BfUtxoInput {
  address: string
  amount: BfAmount[]
  collateral?: boolean
  reference?: boolean
}

interface BfUtxoOutput {
  address: string
  amount: BfAmount[]
}

function lovelaceOf(amount: BfAmount[]): number {
  const found = amount.find(a => a.unit === 'lovelace')
  return found ? Number(found.quantity) : 0
}

export class HttpBlockfrostClient implements BlockfrostClient {
  constructor(
    private readonly baseUrl: string,
    private readonly projectId: string
  ) {}

  private async get<T>(path: string, allow404 = false): Promise<T | null> {
    if (!this.projectId) {
      throw new Error('Chưa cấu hình BLOCKFROST_API_KEY phía server')
    }
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path}`
    const res = await fetch(url, {
      headers: { project_id: this.projectId }
    })
    if (res.status === 404 && allow404) return null
    if (!res.ok) {
      throw new Error(`Blockfrost ${path} trả HTTP ${res.status}`)
    }
    return (await res.json()) as T
  }

  async latestBlockHeight(): Promise<number> {
    const b = await this.get<{ height: number }>('/blocks/latest')
    return Number(b?.height ?? 0)
  }

  async addressTransactions(
    address: string,
    opts?: { count?: number; page?: number; order?: 'asc' | 'desc' }
  ): Promise<BfAddressTx[]> {
    const { count = 50, page = 1, order = 'desc' } = opts ?? {}
    const rows = await this.get<Array<{ tx_hash: string; block_height: number; block_time: number }>>(
      `/addresses/${address}/transactions?order=${order}&count=${count}&page=${page}`,
      true
    )
    return (rows ?? []).map(r => ({
      txHash: r.tx_hash,
      blockHeight: Number(r.block_height),
      blockTime: Number(r.block_time)
    }))
  }

  async txInfo(txHash: string): Promise<BfTxInfo | null> {
    const t = await this.get<{ hash: string; block_height: number; block_time: number }>(`/txs/${txHash}`, true)
    if (!t) return null
    return {
      txHash: t.hash,
      blockHeight: Number(t.block_height),
      blockTime: Number(t.block_time)
    }
  }

  async txUtxos(txHash: string): Promise<BfTxUtxos | null> {
    const u = await this.get<{ inputs: BfUtxoInput[]; outputs: BfUtxoOutput[] }>(`/txs/${txHash}/utxos`, true)
    if (!u) return null
    return {
      inputs: (u.inputs ?? [])
        .filter(i => !i.collateral && !i.reference)
        .map(i => ({ address: i.address, lovelace: lovelaceOf(i.amount) })),
      outputs: (u.outputs ?? []).map(o => ({ address: o.address, lovelace: lovelaceOf(o.amount) }))
    }
  }

  async txExists(txHash: string): Promise<boolean> {
    const t = await this.txInfo(txHash)
    return t !== null
  }

  async txMetadata(txHash: string): Promise<BfTxMetadatum[]> {
    const rows = await this.get<Array<{ label: string; json_metadata: unknown }>>(`/txs/${txHash}/metadata`, true)
    return (rows ?? []).map(r => ({ label: String(r.label), json: r.json_metadata }))
  }
}

interface KoiosTxInfoRow {
  tx_hash: string
  block_height?: number | null
  block_no?: number | null
  tx_timestamp?: number | null
  block_time?: number | null
  inputs?: Array<{
    payment_addr?: { bech32?: string }
    address?: string
    value?: string | number
  }>
  outputs?: Array<{
    payment_addr?: { bech32?: string }
    address?: string
    value?: string | number
  }>
  metadata?: unknown
}

/**
 * Client đọc chuỗi Cardano qua Koios REST API v1 (miễn phí, không bắt buộc API key).
 * Tự động dùng làm mặc định khi người vận hành chưa cấu hình BLOCKFROST_API_KEY,
 * hoặc làm dự phòng khi Blockfrost gặp sự cố.
 */
export class HttpKoiosClient implements BlockfrostClient {
  private txCache = new Map<string, { at: number; row: KoiosTxInfoRow | null }>()
  private addressTxCache = new Map<string, { at: number; rows: BfAddressTx[] }>()
  private tipCache: { at: number; height: number } | null = null
  private rateLimitCooldownUntil = 0

  constructor(
    private readonly baseUrl: string,
    private readonly apiToken = ''
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
    if (this.apiToken) {
      h.Authorization = `Bearer ${this.apiToken}`
    }
    return h
  }

  private async fetchTxRow(txHash: string): Promise<KoiosTxInfoRow | null> {
    const key = txHash.toLowerCase()
    const now = Date.now()
    const cached = this.txCache.get(key)
    if (cached && now - cached.at < (cached.row ? 30_000 : 8_000)) {
      return cached.row
    }
    if (now < this.rateLimitCooldownUntil) {
      return cached ? cached.row : null
    }

    const url = `${this.baseUrl.replace(/\/+$/, '')}/tx_info`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          _tx_hashes: [key],
          _inputs: true,
          _metadata: true,
          _assets: false,
          _withdrawals: false,
          _certs: false,
          _scripts: false,
          _bytecode: false
        })
      })
      if (res.status === 429) {
        this.rateLimitCooldownUntil = now + 45_000
        console.warn('[Koios] HTTP 429 Rate Limit tại /tx_info. Tạm ngưng gọi Koios 45s.')
        return cached ? cached.row : null
      }
      if (!res.ok) {
        throw new Error(`Koios /tx_info trả HTTP ${res.status}`)
      }
      const rows = (await res.json()) as KoiosTxInfoRow[]
      const found = Array.isArray(rows)
        ? rows.find(r => String(r.tx_hash || '').toLowerCase() === key) ?? null
        : null
      // Chỉ coi là đã lên chuỗi khi đã có block_height
      const confirmedRow = found && Number(found.block_height ?? found.block_no ?? 0) > 0 ? found : null
      this.txCache.set(key, { at: now, row: confirmedRow })
      return confirmedRow
    } catch (err: any) {
      if (cached) return cached.row
      throw err
    }
  }

  async latestBlockHeight(): Promise<number> {
    const now = Date.now()
    // 1. Dùng cache tip trong 15 giây (Cardano sinh block trung bình mỗi 20s)
    if (this.tipCache && now - this.tipCache.at < 15_000) {
      return this.tipCache.height
    }

    // 2. Nếu đang trong thời gian hạ nhiệt rate-limit 429
    if (now < this.rateLimitCooldownUntil) {
      if (this.tipCache && this.tipCache.height > 0) {
        return this.tipCache.height
      }
      return 0
    }

    const url = `${this.baseUrl.replace(/\/+$/, '')}/tip`
    try {
      const res = await fetch(url, { headers: this.headers() })
      if (res.status === 429) {
        this.rateLimitCooldownUntil = now + 45_000
        console.warn('[Koios] HTTP 429 Rate Limit tại /tip. Tự động dùng cache gần nhất và hạ nhiệt polling 45s.')
        if (this.tipCache && this.tipCache.height > 0) {
          return this.tipCache.height
        }
        return 0
      }
      if (!res.ok) {
        throw new Error(`Koios /tip trả HTTP ${res.status}`)
      }
      const rows = (await res.json()) as Array<{ block_no?: number; block_height?: number }>
      const top = Array.isArray(rows) ? rows[0] : null
      const height = Number(top?.block_no ?? top?.block_height ?? 0)
      if (height > 0) {
        this.tipCache = { at: now, height }
      }
      return height
    } catch (err: any) {
      if (this.tipCache && this.tipCache.height > 0) {
        return this.tipCache.height
      }
      throw err
    }
  }

  async addressTransactions(
    address: string,
    opts?: { count?: number }
  ): Promise<BfAddressTx[]> {
    const now = Date.now()
    const cached = this.addressTxCache.get(address)
    if (cached && now - cached.at < 15_000) {
      return cached.rows
    }
    if (now < this.rateLimitCooldownUntil) {
      return cached ? cached.rows : []
    }

    const url = `${this.baseUrl.replace(/\/+$/, '')}/address_txs`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ _addresses: [address] })
      })
      if (res.status === 429) {
        this.rateLimitCooldownUntil = now + 45_000
        console.warn('[Koios] HTTP 429 Rate Limit tại /address_txs. Tạm ngưng gọi Koios 45s.')
        return cached ? cached.rows : []
      }
      if (!res.ok) return []
      const rows = (await res.json()) as Array<{ tx_hash: string; block_height?: number; block_time?: number }>
      const limit = opts?.count ?? 50
      const parsed = (Array.isArray(rows) ? rows : []).slice(0, limit).map(r => ({
        txHash: String(r.tx_hash),
        blockHeight: Number(r.block_height ?? 0),
        blockTime: Number(r.block_time ?? 0)
      }))
      this.addressTxCache.set(address, { at: now, rows: parsed })
      return parsed
    } catch {
      return cached ? cached.rows : []
    }
  }

  async txInfo(txHash: string): Promise<BfTxInfo | null> {
    const row = await this.fetchTxRow(txHash)
    if (!row) return null
    return {
      txHash: row.tx_hash,
      blockHeight: Number(row.block_height ?? row.block_no ?? 0),
      blockTime: Number(row.tx_timestamp ?? row.block_time ?? 0)
    }
  }

  async txUtxos(txHash: string): Promise<BfTxUtxos | null> {
    const row = await this.fetchTxRow(txHash)
    if (!row) return null
    const mapIo = (arr?: KoiosTxInfoRow['outputs']): BfTxIo[] =>
      (arr ?? []).map(item => ({
        address: String(item.payment_addr?.bech32 || item.address || ''),
        lovelace: Number(item.value ?? 0)
      }))
    return {
      inputs: mapIo(row.inputs),
      outputs: mapIo(row.outputs)
    }
  }

  async txExists(txHash: string): Promise<boolean> {
    const info = await this.txInfo(txHash)
    return info !== null
  }

  async txMetadata(txHash: string): Promise<BfTxMetadatum[]> {
    const row = await this.fetchTxRow(txHash)
    if (!row || !row.metadata) return []
    const meta = row.metadata
    if (Array.isArray(meta)) {
      return meta.map((m: any) => ({
        label: String(m?.key ?? m?.label ?? ''),
        json: m?.json ?? m?.json_metadata
      }))
    }
    if (typeof meta === 'object') {
      return Object.entries(meta as Record<string, unknown>).map(([label, json]) => ({
        label: String(label),
        json
      }))
    }
    return []
  }
}

let testOverrideClient: BlockfrostClient | null = null

export function setBlockfrostClientForTest(client: BlockfrostClient | null) {
  testOverrideClient = client
}

export function getBlockfrostClient(): BlockfrostClient {
  if (testOverrideClient) return testOverrideClient
  const cfg = getWalletConfig()
  if (cfg.blockfrostApiKey) {
    return new HttpBlockfrostClient(cfg.blockfrostBaseUrl, cfg.blockfrostApiKey)
  }
  const koiosBase = cfg.isTestnet
    ? 'https://preprod.koios.rest/api/v1'
    : 'https://api.koios.rest/api/v1'
  return new HttpKoiosClient(koiosBase, cfg.koiosApiToken)
}

