/**
 * Cấu hình ví Cardano & hệ thống nạp MC phía server.
 * Một nguồn duy nhất cho mạng (preprod/mainnet), địa chỉ treasury, Blockfrost và độ sâu xác nhận.
 */
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'

export type CardanoNetworkName = 'preprod' | 'mainnet'

/** Quy tắc kinh tế: 1 ADA = 1.000.000 lovelace = 1.000 MC => 1 MC = 1.000 lovelace (số nguyên). */
export const LOVELACE_PER_ADA = 1_000_000
export const MC_PER_ADA = 1_000
export const LOVELACE_PER_MC = 1_000
export const MIN_ORDER_ADA = 2
export const MAX_ORDER_ADA = 100_000
export const MIN_ORDER_LOVELACE = MIN_ORDER_ADA * LOVELACE_PER_ADA // 2.000.000 lovelace
export const QUICK_ADA_PACKAGES = [5, 10, 50, 100] as const

/**
 * Địa chỉ treasury mặc định CHỈ dành cho môi trường Preprod Testnet khi dev chưa đặt biến môi trường
 * (sinh tất định từ nhãn công khai 'hydra-pagoda-preprod-treasury-v1' -> địa chỉ enterprise testnet hợp lệ).
 * Trên Mainnet, hệ thống BẮT BUỘC phải cấu hình TREASURY_ADDRESS thật trong .env.
 */
function defaultPreprodTreasuryAddress(): string {
  const hash = blake2b(new TextEncoder().encode('hydra-pagoda-preprod-treasury-v1'), { dkLen: 28 })
  const bytes = new Uint8Array(29)
  bytes[0] = 0x60 // enterprise key-hash address trên testnet (networkId = 0)
  bytes.set(hash, 1)
  return bech32.encode('addr_test', bech32.toWords(bytes), 1023)
}

const DEFAULT_PREPROD_TREASURY = defaultPreprodTreasuryAddress()

export interface WalletConfig {
  network: CardanoNetworkName
  /** CIP-30 getNetworkId(): 0 = testnet (Preprod), 1 = mainnet */
  networkId: 0 | 1
  isTestnet: boolean
  databaseUrl: string
  dbPath: string
  sessionTtlMs: number
  trustProxy: boolean
  /** Địa chỉ ví nhận ADA (treasury). Lấy từ env, không bao giờ do client truyền. */
  treasuryAddress: string
  /** true nếu đang dùng địa chỉ mẫu Preprod (dev chưa đặt TREASURY_ADDRESS riêng) */
  isDefaultTestnetTreasury: boolean
  blockfrostApiKey: string
  blockfrostBaseUrl: string
  /** Tùy chọn Koios Bearer token nếu dùng Koios */
  koiosApiToken: string
  /** Số xác nhận tối thiểu trên chuỗi trước khi cộng MC (Preprod: 1, Mainnet: 3) */
  confirmationsRequired: number
  /** Thời hạn đơn hàng (ms), mặc định 30 phút */
  orderTtlMs: number
  /** Nhãn metadata giao dịch chứa orderId (mặc định 8181) */
  orderMetadataLabel: number
  webhookSecret: string
}

export function getWalletConfig(): WalletConfig {
  const rc: Record<string, any> = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : { public: {} }
  const raw = String(process.env.NUXT_PUBLIC_CARDANO_NETWORK || rc.public?.cardanoNetwork || 'preprod').toLowerCase()
  const network: CardanoNetworkName = raw === 'mainnet' ? 'mainnet' : 'preprod'
  const isTestnet = network !== 'mainnet'
  const hours = Math.max(1, Number(process.env.NUXT_SESSION_TTL_HOURS || rc.sessionTtlHours) || 168)

  const envTreasury = String(
    process.env.NUXT_TREASURY_ADDRESS ||
    process.env.TREASURY_ADDRESS ||
    process.env.OPERATOR_DEPOSIT_ADDRESS ||
    rc.treasuryAddress ||
    ''
  ).trim()

  const treasuryAddress = envTreasury || (isTestnet ? DEFAULT_PREPROD_TREASURY : '')
  const isDefaultTestnetTreasury = !envTreasury && isTestnet

  const blockfrostApiKey = String(
    process.env.NUXT_BLOCKFROST_API_KEY ||
    process.env.BLOCKFROST_API_KEY ||
    rc.blockfrostApiKey ||
    ''
  ).trim()

  const envBfUrl = String(
    process.env.NUXT_BLOCKFROST_BASE_URL ||
    process.env.BLOCKFROST_BASE_URL ||
    rc.blockfrostBaseUrl ||
    ''
  ).trim()

  const blockfrostBaseUrl = envBfUrl || (
    isTestnet
      ? 'https://cardano-preprod.blockfrost.io/api/v0'
      : 'https://cardano-mainnet.blockfrost.io/api/v0'
  )

  const koiosApiToken = String(
    process.env.NUXT_KOIOS_API_TOKEN ||
    process.env.KOIOS_API_TOKEN ||
    rc.koiosApiToken ||
    ''
  ).trim()

  const rawConf = Number(process.env.NUXT_CONFIRMATIONS_REQUIRED || rc.confirmationsRequired || 0)
  const confirmationsRequired = rawConf > 0 ? Math.floor(rawConf) : (isTestnet ? 1 : 3)

  const ttlMinutes = Math.max(5, Number(process.env.NUXT_ORDER_TTL_MINUTES || rc.orderTtlMinutes) || 30)
  const orderMetadataLabel = Math.max(1, Number(process.env.NUXT_ORDER_METADATA_LABEL || rc.orderMetadataLabel) || 8181)
  const webhookSecret = String(process.env.NUXT_WEBHOOK_SECRET || rc.webhookSecret || '').trim()

  const databaseUrl = String(
    process.env.NUXT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    rc.databaseUrl ||
    ''
  ).trim()

  return {
    network,
    networkId: isTestnet ? 0 : 1,
    isTestnet,
    databaseUrl,
    dbPath: String(process.env.NUXT_DB_PATH || rc.dbPath || './.data/pagoda.sqlite'),
    sessionTtlMs: hours * 3600_000,
    trustProxy: rc.trustProxy === true || String(process.env.NUXT_TRUST_PROXY || rc.trustProxy) === 'true',
    treasuryAddress,
    isDefaultTestnetTreasury,
    blockfrostApiKey,
    blockfrostBaseUrl,
    koiosApiToken,
    confirmationsRequired,
    orderTtlMs: ttlMinutes * 60_000,
    orderMetadataLabel,
    webhookSecret
  }
}
