/**
 * Helper CIP-30 phía trình duyệt (không phụ thuộc WASM để bundle SPA nhẹ).
 * Ý tưởng hex->bech32 và luồng enable/signData tham khảo
 * D:\Vtechcom\hydra-graveyard\apps\web-client\app\lib\cardano.ts và stores\wallet.ts
 * (viết lại, dùng @scure/base thay vì CardanoWASM).
 */
import { bech32 } from '@scure/base'
import { decode as cborDecode } from 'cbor2'

export interface Cip30Api {
  getNetworkId(): Promise<number>
  getUsedAddresses(): Promise<string[]>
  getUnusedAddresses?(): Promise<string[]>
  getChangeAddress(): Promise<string>
  getBalance(): Promise<string>
  getUtxos?(amount?: string, paginate?: { page: number; limit: number }): Promise<string[] | null>
  signData(addr: string, payloadHex: string): Promise<{ signature: string; key: string }>
  signTx(txHex: string, partialSign?: boolean): Promise<string>
  submitTx(txHex: string): Promise<string>
}

export interface Cip30Injected {
  name?: string
  icon?: string
  enable(): Promise<Cip30Api>
  isEnabled?(): Promise<boolean>
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
}

export const utf8ToHex = (s: string) => bytesToHex(new TextEncoder().encode(s))

/** CIP-30 trả địa chỉ dạng hex CBOR; đổi sang bech32 (`addr1…` / `addr_test1…`) để hiển thị/gửi server. */
export function hexToBech32(hexAddress: string): string {
  const bytes = hexToBytes(hexAddress)
  const prefix = (bytes[0]! & 0x0f) === 1 ? 'addr' : 'addr_test'
  return bech32.encode(prefix, bech32.toWords(bytes), 1023)
}

/** Giải `getBalance()` (CBOR): số nguyên lovelace hoặc [lovelace, multiasset]. */
export function decodeLovelace(balanceHex: string): bigint {
  const v = cborDecode(hexToBytes(balanceHex)) as unknown
  const coin = Array.isArray(v) ? v[0] : v
  if (typeof coin === 'bigint') return coin
  if (typeof coin === 'number') return BigInt(coin)
  return 0n
}

export function getInjected(key: string): Cip30Injected | null {
  if (typeof window === 'undefined') return null
  const w = (window as any).cardano
  return w?.[key] ?? null
}

/** Ví thường được inject trễ sau khi trang tải: đợi tối đa `ms` để tự kết nối lại đúng lúc. */
export async function waitForInjected(key: string, ms = 2500): Promise<Cip30Injected | null> {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const w = getInjected(key)
    if (w) return w
    await new Promise(r => setTimeout(r, 150))
  }
  return getInjected(key)
}

export type WalletErrorCode =
  | 'not_installed' | 'user_declined' | 'wallet_locked' | 'wrong_network'
  | 'sign_declined' | 'sign_failed' | 'server_error' | 'session_lost' | 'account_changed' | 'network_changed'
  | 'tx_declined' | 'tx_insufficient_funds' | 'tx_submit_failed'

/** Phân loại lỗi CIP-30 (APIError code -3 từ chối, -2 từ chối/refused, TxSignError code 2 ...). */
export function classifyCip30Error(e: any, fallback: WalletErrorCode): WalletErrorCode {
  const code = e?.code ?? e?.info?.code
  const msg = String(e?.message ?? e?.info ?? e ?? '').toLowerCase()
  if (code === 2 || code === -3 || msg.includes('declin') || msg.includes('reject') || msg.includes('cancel') || msg.includes('denied') || msg.includes('refus')) {
    if (fallback === 'tx_submit_failed') return 'tx_declined'
    return fallback === 'sign_failed' ? 'sign_declined' : 'user_declined'
  }
  if (msg.includes('lock') || msg.includes('password') || msg.includes('unlock')) return 'wallet_locked'
  return fallback
}

export const WALLET_ERROR_TEXT: Record<WalletErrorCode, string> = {
  not_installed: 'Chưa cài ví. Hãy cài Eternl rồi tải lại trang.',
  user_declined: 'Bạn đã từ chối kết nối ví.',
  wallet_locked: 'Ví đang bị khóa. Hãy mở khóa Eternl rồi thử lại.',
  wrong_network: 'Ví đang ở sai mạng.',
  sign_declined: 'Bạn đã từ chối ký thông điệp đăng nhập.',
  sign_failed: 'Ký thông điệp thất bại. Vui lòng thử lại.',
  server_error: 'Máy chủ từ chối xác thực. Vui lòng thử lại.',
  session_lost: 'Phiên đăng nhập đã hết hạn hoặc ví đã bị tắt. Hãy kết nối lại.',
  account_changed: 'Bạn đã đổi tài khoản trong ví nên đã được đăng xuất. Hãy kết nối lại.',
  network_changed: 'Bạn đã đổi mạng trong ví nên đã được đăng xuất. Hãy kết nối lại.',
  tx_declined: 'Bạn đã từ chối ký giao dịch mua MC trong ví.',
  tx_insufficient_funds: 'Số dư ADA trong ví không đủ để thanh toán gói này kèm phí mạng (~0.2 ADA).',
  tx_submit_failed: 'Gửi giao dịch lên mạng Cardano thất bại. Vui lòng kiểm tra ví và thử lại.'
}

