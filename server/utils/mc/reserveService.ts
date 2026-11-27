/**
 * Bằng chứng dự trữ (Proof of Reserve) đối soát trực tiếp L1 <-> L2 cho token MC:
 * - Tổng cung MC on-chain (Blockfrost `assets/{unit}`) phải bằng 1.000.000.000.
 * - Policy đã khóa vĩnh viễn (NativeScript `before slot` đã qua so với slot hiện tại).
 * - MC thật đang nằm trong các ví quỹ L1 (Ví Quỹ Nóng + Ví Quỹ Bán/Nhiệm Vụ nếu cấu hình) >= Tổng MC L2 của toàn bộ người chơi.
 * Kết quả được cache 30 giây để không vượt hạn mức Blockfrost.
 */
import { MC_ASSET_NAME_HEX, MC_TOTAL_SUPPLY } from '../../../lib/mc/tokenomics'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { getWalletConfig } from '../wallet/config'
import { getDb } from '../wallet/db'

export interface ReserveVaultInfo {
  label: string
  address: string
  mc: string
}

export interface ReserveProof {
  ok: boolean
  configured: boolean
  network: 'preprod' | 'mainnet'
  policyId: string
  assetUnit: string
  onChainSupply: string
  expectedSupply: string
  supplyMatches: boolean
  policyLocked: boolean | null
  expirySlot: number | null
  currentSlot: number | null
  l1ReserveMc: string
  l2TotalMc: string
  coverageOk: boolean
  surplusMc: string
  vaults: ReserveVaultInfo[]
  explorerTokenUrl: string
  checkedAt: number
  error?: string
}

let cache: { at: number; value: ReserveProof } | null = null
const CACHE_TTL_MS = 30_000

async function bfGet(base: string, key: string, path: string) {
  const res = await fetch(`${base}${path}`, { headers: { project_id: key } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Blockfrost ${path} -> HTTP ${res.status}`)
  return res.json()
}

function hotVaultAddress(networkId: number): string {
  const skeyHex = (process.env.MC_HOT_VAULT_SKEY_HEX || process.env.MC_POLICY_SKEY_HEX || '').trim()
  if (!skeyHex) return ''
  try {
    const sk = C.PrivateKey.from_normal_bytes(Buffer.from(skeyHex, 'hex'))
    return C.EnterpriseAddress.new(networkId, C.Credential.from_keyhash(sk.to_public().hash())).to_address().to_bech32()
  } catch {
    return ''
  }
}

async function addressMc(base: string, key: string, address: string, assetUnit: string): Promise<bigint> {
  let total = 0n
  for (let page = 1; page <= 5; page++) {
    const utxos = await bfGet(base, key, `/addresses/${address}/utxos?page=${page}&count=100`)
    if (!Array.isArray(utxos) || utxos.length === 0) break
    for (const u of utxos) {
      for (const a of u.amount || []) {
        if (a.unit === assetUnit) total += BigInt(a.quantity)
      }
    }
    if (utxos.length < 100) break
  }
  return total
}

/** Tìm slot khóa của policy từ NativeScript JSON (`type: 'before'`) lưu trên chuỗi. */
function findExpirySlot(script: any): number | null {
  if (!script || typeof script !== 'object') return null
  if (script.type === 'before' && Number.isFinite(Number(script.slot))) return Number(script.slot)
  if (Array.isArray(script.scripts)) {
    for (const s of script.scripts) {
      const found = findExpirySlot(s)
      if (found !== null) return found
    }
  }
  return null
}

export async function getReserveProof(force = false): Promise<ReserveProof> {
  const now = Date.now()
  if (!force && cache && now - cache.at < CACHE_TTL_MS) return cache.value

  const cfg = getWalletConfig()
  const policyId = (process.env.NUXT_MC_POLICY_ID || '').trim().toLowerCase()
  const assetUnit = policyId ? `${policyId}${MC_ASSET_NAME_HEX}` : ''
  const explorerBase = cfg.isTestnet ? 'https://preprod.cardanoscan.io' : 'https://cardanoscan.io'

  const base: ReserveProof = {
    ok: false,
    configured: Boolean(policyId && cfg.blockfrostApiKey),
    network: cfg.network,
    policyId,
    assetUnit,
    onChainSupply: '0',
    expectedSupply: MC_TOTAL_SUPPLY.toString(),
    supplyMatches: false,
    policyLocked: null,
    expirySlot: null,
    currentSlot: null,
    l1ReserveMc: '0',
    l2TotalMc: '0',
    coverageOk: false,
    surplusMc: '0',
    vaults: [],
    explorerTokenUrl: assetUnit ? `${explorerBase}/token/${assetUnit}` : '',
    checkedAt: now
  }

  // Tổng MC L2 của toàn bộ người chơi (số dư lưu ký trong sổ cái)
  const db = await getDb()
  const l2Row = (await db.prepare('SELECT COALESCE(SUM(mc_balance), 0) AS total FROM accounts').get()) as { total: number } | undefined
  const l2Total = BigInt(l2Row?.total ?? 0)
  base.l2TotalMc = l2Total.toString()

  if (!base.configured) {
    base.error = 'Chưa cấu hình NUXT_MC_POLICY_ID hoặc Blockfrost trên server'
    cache = { at: now, value: base }
    return base
  }

  try {
    const [asset, tip, script] = await Promise.all([
      bfGet(cfg.blockfrostBaseUrl, cfg.blockfrostApiKey, `/assets/${assetUnit}`),
      bfGet(cfg.blockfrostBaseUrl, cfg.blockfrostApiKey, '/blocks/latest'),
      bfGet(cfg.blockfrostBaseUrl, cfg.blockfrostApiKey, `/scripts/${policyId}/json`).catch(() => null)
    ])

    const supply = BigInt(asset?.quantity || '0')
    base.onChainSupply = supply.toString()
    base.supplyMatches = supply === MC_TOTAL_SUPPLY
    base.currentSlot = Number(tip?.slot ?? 0) || null

    const expirySlot = findExpirySlot(script?.json)
    base.expirySlot = expirySlot
    base.policyLocked = expirySlot !== null && base.currentSlot !== null ? base.currentSlot > expirySlot : null

    // Các ví quỹ L1: Ví Quỹ Nóng (suy ra từ khóa) + Ví Quỹ Bán/Nhiệm Vụ cấu hình (nếu khác nhau)
    const candidates: Array<{ label: string; address: string }> = []
    const hot = hotVaultAddress(cfg.networkId)
    if (hot) candidates.push({ label: 'Ví Quỹ Nóng (ký Co-sign)', address: hot })
    const saleVault = (process.env.NUXT_MC_SALE_VAULT_ADDRESS || '').trim()
    const questVault = (process.env.NUXT_MC_QUEST_VAULT_ADDRESS || '').trim()
    if (saleVault) candidates.push({ label: 'Ví Quỹ Bán', address: saleVault })
    if (questVault && questVault !== saleVault) candidates.push({ label: 'Ví Quỹ Nhiệm Vụ', address: questVault })

    const seen = new Set<string>()
    let l1Reserve = 0n
    for (const c of candidates) {
      if (seen.has(c.address)) continue
      seen.add(c.address)
      const mc = await addressMc(cfg.blockfrostBaseUrl, cfg.blockfrostApiKey, c.address, assetUnit)
      l1Reserve += mc
      base.vaults.push({ label: c.label, address: c.address, mc: mc.toString() })
    }
    base.l1ReserveMc = l1Reserve.toString()
    base.coverageOk = l1Reserve >= l2Total
    base.surplusMc = (l1Reserve >= l2Total ? l1Reserve - l2Total : 0n).toString()
    base.ok = base.supplyMatches && base.coverageOk
  } catch (e: any) {
    base.error = e?.message || 'Không đọc được dữ liệu Cardano L1'
  }

  cache = { at: now, value: base }
  return base
}
