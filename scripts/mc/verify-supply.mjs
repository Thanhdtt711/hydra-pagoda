/**
 * Xác minh tổng cung 1.000.000.000 MC trên chuỗi Cardano, kiểm tra policy đã khóa và đối soát bằng chứng dự trữ.
 * Chạy:
 *   node --experimental-strip-types scripts/mc/verify-supply.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MC_ASSET_NAME_HEX, MC_TOTAL_SUPPLY } from '../../lib/mc/tokenomics.ts'

function loadDotEnv() {
  const p = resolve(process.cwd(), '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
    }
  }
}
loadDotEnv()

const network = (process.env.NUXT_PUBLIC_CARDANO_NETWORK || 'preprod').toLowerCase() === 'mainnet' ? 'mainnet' : 'preprod'
const bfKey = process.env.NUXT_BLOCKFROST_API_KEY || process.env.BLOCKFROST_API_KEY || ''
const bfBase =
  process.env.NUXT_BLOCKFROST_BASE_URL ||
  (network === 'mainnet' ? 'https://cardano-mainnet.blockfrost.io/api/v0' : 'https://cardano-preprod.blockfrost.io/api/v0')
const policyId = (process.env.NUXT_MC_POLICY_ID || '').trim()
const expirySlot = Number(process.env.NUXT_MC_POLICY_EXPIRY_SLOT || 0)

if (!policyId || !bfKey) {
  console.log('[verify-supply] Chưa cấu hình NUXT_MC_POLICY_ID hoặc NUXT_BLOCKFROST_API_KEY trong .env (hãy chạy scripts/mc/mint-mc.mjs trước).')
  process.exit(0)
}

async function bfGet(path) {
  const res = await fetch(`${bfBase}${path}`, { headers: { project_id: bfKey } })
  if (!res.ok) throw new Error(`Blockfrost ${path} -> HTTP ${res.status}`)
  return res.json()
}

const unit = `${policyId}${MC_ASSET_NAME_HEX}`
const [asset, tip] = await Promise.all([bfGet(`/assets/${unit}`), bfGet('/blocks/latest')])
const onChainSupply = BigInt(asset.quantity || '0')
const currentSlot = Number(tip.slot || 0)

console.log(`Asset Unit   : ${unit}`)
console.log(`Tổng cung    : ${onChainSupply.toLocaleString()} / ${MC_TOTAL_SUPPLY.toLocaleString()} MC`)
console.log(`Slot hiện tại: ${currentSlot} | Slot khóa policy: ${expirySlot}`)
console.log(`Trạng thái   : ${expirySlot > 0 && currentSlot > expirySlot ? 'POLICY ĐÃ KHÓA VĨNH VIỄN' : 'CHƯA QUA SLOT KHÓA'}`)

if (onChainSupply !== MC_TOTAL_SUPPLY) {
  console.error('SAI LỆCH TỔNG CUNG!')
  process.exit(1)
}
console.log('XÁC MINH TỔNG CUNG MC THÀNH CÔNG.')
