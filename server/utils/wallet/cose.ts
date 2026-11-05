/**
 * Xác thực chữ ký CIP-8 / COSE_Sign1 do CIP-30 `signData` trả về.
 *
 * NGUỒN GỐC Ý TƯỞNG/CODE: D:\Vtechcom\hydra-graveyard\apps\graveyard-engine\src\auth\cose.ts
 * (chỉ lấy phần logic xác thực thuần TS; đã bỏ phụ thuộc NestJS, viết lại cho Nitro,
 * thêm kiểm tra độ dài địa chỉ/loại địa chỉ và so sánh thời gian hằng). Không sao chép
 * khóa, seed hay cấu hình nào.
 *
 * Vì sao tự verify thay vì tin địa chỉ client gửi: địa chỉ chỉ là chuỗi do client khai báo;
 * chỉ chữ ký ed25519 hợp lệ + khóa công khai băm ra đúng payment key hash trong địa chỉ mới
 * chứng minh người gọi nắm khóa riêng của ví đó.
 */
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { decode as cborDecode, encode as cborEncode } from 'cbor2'

const COSE_KEY_X = -2 // nhãn tọa độ x của COSE_Key (OKP)

export interface CoseVerifyResult {
  /** Chữ ký ed25519 hợp lệ trên Sig_structure */
  valid: boolean
  /** Byte địa chỉ ví lấy từ protected header (CIP-30 đặt địa chỉ người ký ở đây) */
  addressBytes: Uint8Array
  /** Khóa công khai ed25519 32 byte từ COSE_Key */
  publicKey: Uint8Array
  /** Payload đã ký (hoặc blake2b-224 của nó nếu `hashed`) */
  payload: Uint8Array
  /** true nếu ví ký băm blake2b-224 của payload thay vì payload gốc */
  hashed: boolean
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) throw new Error('hex không hợp lệ')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

function mapGet(m: unknown, key: string | number): unknown {
  if (m instanceof Map) return m.get(key)
  if (m && typeof m === 'object') return (m as Record<string | number, unknown>)[key]
  return undefined
}

function asBytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v
  throw new Error('cần CBOR byte string')
}

/** So sánh hằng thời gian để không lộ thông tin qua thời gian phản hồi. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

/**
 * Verify COSE_Sign1 + COSE_Key. Ném lỗi khi cấu trúc sai; trả `valid:false` khi cấu trúc
 * đúng nhưng chữ ký sai.
 */
export function verifyCoseSign1(signatureHex: string, keyHex: string): CoseVerifyResult {
  const sign1 = cborDecode(hexToBytes(signatureHex))
  if (!Array.isArray(sign1) || sign1.length !== 4) throw new Error('COSE_Sign1 phải là mảng 4 phần tử')
  const [protectedBstr, , payloadField, sig] = sign1 as [Uint8Array, unknown, unknown, Uint8Array]
  const protectedBytes = asBytes(protectedBstr)
  const signature = asBytes(sig)
  if (payloadField == null) throw new Error('Thiếu payload (detached) – không thể xác minh')
  const payload = asBytes(payloadField)

  const protectedMap = protectedBytes.length ? cborDecode(protectedBytes) : new Map()
  const addressBytes = asBytes(mapGet(protectedMap, 'address'))
  const hashed = mapGet(protectedMap, 'hashed') === true

  const keyMap = cborDecode(hexToBytes(keyHex))
  const publicKey = asBytes(mapGet(keyMap, COSE_KEY_X))
  if (publicKey.length !== 32) throw new Error('COSE_Key x phải là khóa ed25519 32 byte')

  const sigStructure = cborEncode(['Signature1', protectedBytes, new Uint8Array(0), payload])
  let valid = false
  try {
    valid = ed25519.verify(signature, sigStructure, publicKey)
  } catch {
    valid = false
  }
  return { valid, addressBytes, publicKey, payload, hashed }
}

/** blake2b-224 (28 byte): băm khóa công khai ra credential của Cardano. */
export function blake2b224(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 28 })
}

/** Loại địa chỉ Shelley = 4 bit cao của byte đầu. */
export function addressType(addressBytes: Uint8Array): number {
  return addressBytes[0]! >> 4
}

/** Network id nằm ở 4 bit thấp của byte đầu: 1 = mainnet, 0 = testnet. */
export function addressNetworkId(addressBytes: Uint8Array): number {
  if (addressBytes.length < 1) throw new Error('địa chỉ rỗng')
  return addressBytes[0]! & 0x0f
}

/**
 * Payment key hash 28 byte của địa chỉ Shelley dạng base/enterprise/pointer (loại 0–3, 6, 7)
 * có payment credential là KEY hash. Địa chỉ script (loại lẻ cho payment script) không thể
 * ký bằng khóa đơn nên bị từ chối.
 */
export function paymentKeyHashFromAddress(addressBytes: Uint8Array): Uint8Array {
  if (addressBytes.length < 29) throw new Error('địa chỉ quá ngắn')
  const type = addressType(addressBytes)
  // loại 0 base(key,key) 1 base(script,key) 2 base(key,script) 3 base(script,script)
  // 4 ptr(key) 5 ptr(script) 6 enterprise(key) 7 enterprise(script)
  const paymentIsKey = [0, 2, 4, 6].includes(type)
  if (!paymentIsKey) throw new Error('địa chỉ không có payment key credential')
  return addressBytes.slice(1, 29)
}

/** bech32 từ byte địa chỉ (`addr` mainnet, `addr_test` testnet). */
export function encodeBech32Address(addressBytes: Uint8Array): string {
  const prefix = addressNetworkId(addressBytes) === 1 ? 'addr' : 'addr_test'
  return bech32.encode(prefix, bech32.toWords(addressBytes), 1023)
}

/** Giải bech32 -> byte địa chỉ; ném lỗi nếu sai checksum/tiền tố. */
export function decodeBech32Address(address: string): Uint8Array {
  const { prefix, words } = bech32.decode(address as `${string}1${string}`, 1023)
  if (prefix !== 'addr' && prefix !== 'addr_test') throw new Error('tiền tố địa chỉ không hợp lệ')
  return Uint8Array.from(bech32.fromWords(words))
}

