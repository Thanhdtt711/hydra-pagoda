// Tự động Commit UTxO mồi (Fuel) từ Cardano Preprod L1 vào Hydra Head trên Hexcore:
//   npm run hydra:commit
//
// Quy trình:
//   1. Đọc NUXT_HYDRA_SESSION_SECRET, NUXT_BLOCKFROST_API_KEY, HYDRA_NODE_WS_URL từ .env
//   2. Dẫn xuất khóa Fuel (fuelKey) và địa chỉ Fuel trên Preprod:
//      addr_test1vp05c04jd9hcnvynjsjqrlt5t3d5krxysc2ucvtwlqsh0csrwqk29
//   3. Kiểm tra số dư UTxO trên Cardano Preprod L1 của địa chỉ Fuel qua Blockfrost.
//      (Nếu chưa có tADA, hướng dẫn người dùng chuyển 50-100 tADA từ ví Eternl sang địa chỉ Fuel).
//   4. Kiểm tra trạng thái Head trên Hexcore qua WebSocket:
//      - Nếu Head đang 'Idle': tự động gửi { tag: 'Init' } và chờ 'HeadIsInitializing'.
//      - Nếu Head đang 'Initializing': tiếp tục sang bước Commit.
//      - Nếu Head đã 'Open' rỗng (0 UTxO): báo người dùng Close / tạo Head mới vì Head đã Open không thể gọi /commit của v1.
//   5. Gọi HTTP POST .../commit trên Hexcore với UTxO L1 của địa chỉ Fuel.
//   6. Ký giao dịch Commit (cborHex) bằng khóa riêng fuelKey.sk (@hydra-sdk/cardano-wasm).
//   7. Gửi giao dịch đã ký lên Cardano Preprod L1 qua Blockfrost (/tx/submit).
import fs from 'node:fs'
import path from 'node:path'
import { createHmac } from 'node:crypto'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'

const ROOT = process.cwd()
const ENV_PATH = path.join(ROOT, '.env')

function readEnv() {
  const out = {}
  if (!fs.existsSync(ENV_PATH)) return out
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
  }
  return out
}

const env = { ...readEnv(), ...process.env }
const secret = env.NUXT_HYDRA_SESSION_SECRET || env.HYDRA_SESSION_SECRET
const bfKey = env.NUXT_BLOCKFROST_API_KEY
const wsUrl = env.HYDRA_NODE_WS_URL || env.NUXT_HYDRA_NODE_WS_URL

if (!secret) {
  console.error('❌ Thiếu NUXT_HYDRA_SESSION_SECRET trong .env')
  process.exit(1)
}
if (!bfKey) {
  console.error('❌ Thiếu NUXT_BLOCKFROST_API_KEY trong .env')
  process.exit(1)
}
if (!wsUrl) {
  console.error('❌ Thiếu HYDRA_NODE_WS_URL trong .env')
  process.exit(1)
}

const network = (env.NUXT_PUBLIC_CARDANO_NETWORK || 'preprod').toLowerCase()
const networkId = network === 'mainnet' ? 1 : 0
const bfBase =
  env.NUXT_BLOCKFROST_BASE_URL ||
  (network === 'mainnet'
    ? 'https://cardano-mainnet.blockfrost.io/api/v0'
    : 'https://cardano-preprod.blockfrost.io/api/v0')

// 1. Dẫn xuất khóa Fuel
const fuelSeed = createHmac('sha256', secret).update('hydra-pagoda:l2-fuel:v1').digest()
const fuelSk = C.PrivateKey.from_normal_bytes(new Uint8Array(fuelSeed))
const fuelPk = fuelSk.to_public()
const fuelAddress = C.EnterpriseAddress.new(networkId, C.Credential.from_keyhash(fuelPk.hash()))
  .to_address()
  .to_bech32(undefined)

console.log(`🔑 Địa chỉ Fuel L1/L2 (${network}): ${fuelAddress}`)

// 2. Lấy UTxO trên L1 của địa chỉ Fuel từ Blockfrost
const utxoRes = await fetch(`${bfBase}/addresses/${fuelAddress}/utxos`, {
  headers: { project_id: bfKey }
})

if (utxoRes.status === 404) {
  console.log('\n⚠️ Địa chỉ Fuel hiện CHƯA CÓ tADA nào trên Cardano Preprod L1!')
  console.log(`👉 Bước 1: Mở ví Eternl (Preprod) của bạn và chuyển khoảng 50 - 100 tADA tới địa chỉ:`)
  console.log(`   ${fuelAddress}`)
  console.log(`👉 Bước 2: Chờ ~20 giây cho giao dịch L1 xác nhận rồi chạy lại: npm run hydra:commit\n`)
  process.exit(1)
}

if (!utxoRes.ok) {
  console.error(`❌ Lỗi gọi Blockfrost (${utxoRes.status}):`, await utxoRes.text())
  process.exit(1)
}

const l1Utxos = await utxoRes.json()
const pureAdaUtxos = l1Utxos
  .filter((u) => Array.isArray(u.amount) && u.amount.length === 1 && u.amount[0].unit === 'lovelace' && !u.reference_script_hash)
  .map((u) => ({
    ref: `${u.tx_hash}#${u.output_index}`,
    lovelace: Number(u.amount[0].quantity),
    inlineDatum: u.inline_datum || null,
    datumHash: u.data_hash || null
  }))
  .sort((a, b) => b.lovelace - a.lovelace)

if (pureAdaUtxos.length === 0) {
  console.log('\n⚠️ Không tìm thấy UTxO thuần ADA trên L1 tại địa chỉ Fuel.')
  console.log(`👉 Hãy chuyển 50 - 100 tADA từ ví Eternl tới: ${fuelAddress}\n`)
  process.exit(1)
}

const chosen = pureAdaUtxos[0]
console.log(`✔ Tìm thấy UTxO trên L1: ${chosen.ref} (${(chosen.lovelace / 1_000_000).toFixed(2)} ADA)`)

// 3. Kiểm tra trạng thái Head qua WebSocket (nếu Idle -> gửi Init)
function buildHttpCommitUrl(rawWsUrl) {
  const u = new URL(rawWsUrl)
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:'
  // Hexcore định tuyến HTTP REST qua /api/heads/<id>/nodes/<n>/socket/commit
  u.pathname = u.pathname.replace(/\/$/, '') + '/commit'
  u.searchParams.delete('history')
  return u.toString()
}

function getApiKeyFromUrl(rawWsUrl) {
  try {
    return new URL(rawWsUrl).searchParams.get('X-Api-Key') || ''
  } catch {
    return ''
  }
}

async function ensureHeadInitializing(rawWsUrl) {
  return new Promise((resolve, reject) => {
    const sep = rawWsUrl.includes('?') ? '&' : '?'
    const ws = new WebSocket(`${rawWsUrl}${sep}history=no`)
    const timer = setTimeout(() => {
      try { ws.close() } catch {}
      reject(new Error('Hết thời gian chờ trạng thái Head từ hydra-node (120s)'))
    }, 120000)

    ws.onmessage = (ev) => {
      let msg
      try { msg = JSON.parse(String(ev.data)) } catch { return }
      if (msg.tag === 'Greetings') {
        console.log(`ℹ Trạng thái Head hiện tại: ${msg.headStatus}`)
        if (msg.headStatus === 'Initializing' || msg.headStatus === 'Open') {
          clearTimeout(timer)
          ws.close()
          resolve(msg.headStatus)
        } else if (msg.headStatus === 'Idle' || msg.headStatus === 'Final') {
          console.log('⏳ Head đang Idle/Final -> Gửi lệnh { "tag": "Init" } để khởi tạo Head (chờ ~20-40s trên L1)...')
          ws.send(JSON.stringify({ tag: 'Init' }))
        } else if (msg.headStatus === 'FanoutPossible') {
          console.log('⏳ Head đang FanoutPossible -> Tự động gửi { "tag": "Fanout" } để hoàn tất đóng Head cũ (chờ ~20-40s trên L1)...')
          ws.send(JSON.stringify({ tag: 'Fanout' }))
        } else if (msg.headStatus === 'Closed') {
          console.log('⏳ Head đang Closed -> Đang chờ hết thời gian tranh chấp để sang ReadyToFanout...')
        } else {
          clearTimeout(timer)
          ws.close()
          resolve(msg.headStatus)
        }
      } else if (msg.tag === 'ReadyToFanout') {
        console.log('⏳ Nhận ReadyToFanout -> Tự động gửi { "tag": "Fanout" }...')
        ws.send(JSON.stringify({ tag: 'Fanout' }))
      } else if (msg.tag === 'HeadIsFinalized') {
        console.log('✔ Head cũ đã Finalized! Đang gửi { "tag": "Init" } để mở Head mới (chờ ~20-40s trên L1)...')
        ws.send(JSON.stringify({ tag: 'Init' }))
      } else if (msg.tag === 'HeadIsInitializing') {
        console.log('✔ Head đã chuyển sang trạng thái Initializing!')
        clearTimeout(timer)
        ws.close()
        resolve('Initializing')
      } else if (msg.tag === 'HeadIsOpen') {
        console.log('✔ Head đã chuyển sang trạng thái Open!')
        clearTimeout(timer)
        ws.close()
        resolve('Open')
      } else if (msg.tag === 'CommandFailed' || msg.tag === 'PostTxOnChainFailed') {
        console.warn(`⚠️ hydra-node báo ${msg.tag}:`, JSON.stringify(msg).slice(0, 250))
      }
    }
    ws.onerror = (e) => {
      clearTimeout(timer)
      reject(new Error(`Lỗi kết nối WebSocket: ${e?.message || 'unknown'}`))
    }
  })
}

const headStatus = await ensureHeadInitializing(wsUrl)
if (headStatus !== 'Open' && headStatus !== 'Initializing') {
  console.error(`❌ Trạng thái Head (${headStatus}) không thể Commit/Deposit. Cần trạng thái Open hoặc Initializing.`)
  process.exit(1)
}
console.log(`✔ Head đang ở trạng thái ${headStatus} -> Tiến hành gọi POST /commit để nạp UTxO vào Head...`)

// 4. Gọi HTTP POST /commit tới hydra-node trên Hexcore
const commitUrl = buildHttpCommitUrl(wsUrl)
console.log(`⏳ Đang gọi POST /commit tới Hexcore...`)
const commitPayload = {
  [chosen.ref]: {
    address: fuelAddress,
    value: { lovelace: chosen.lovelace },
    datum: null,
    datumhash: chosen.datumHash,
    inlineDatum: chosen.inlineDatum,
    referenceScript: null
  }
}

const apiKey = getApiKeyFromUrl(wsUrl)
const commitHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' }
if (apiKey) commitHeaders['X-Api-Key'] = apiKey

const commitRes = await fetch(commitUrl, {
  method: 'POST',
  headers: commitHeaders,
  body: JSON.stringify(commitPayload)
})

if (!commitRes.ok) {
  console.error(`❌ POST /commit thất bại (${commitRes.status}):`, await commitRes.text())
  process.exit(1)
}

const draftTx = await commitRes.json()
if (!draftTx?.cborHex) {
  console.error('❌ Phản hồi /commit không có cborHex:', draftTx)
  process.exit(1)
}

// 5. Ký giao dịch Commit bằng khóa riêng fuelSk
const fixed = C.FixedTransaction.from_hex(draftTx.cborHex)
fixed.sign_and_add_vkey_signature(fuelSk)
const signedHex = fixed.to_hex()
const signedBytes = Buffer.from(signedHex, 'hex')

// 6. Gửi giao dịch đã ký lên Cardano Preprod L1 qua Blockfrost
console.log('⏳ Đang gửi giao dịch Commit đã ký lên Cardano Preprod L1...')
const submitRes = await fetch(`${bfBase}/tx/submit`, {
  method: 'POST',
  headers: {
    project_id: bfKey,
    'Content-Type': 'application/cbor'
  },
  body: signedBytes
})

if (!submitRes.ok) {
  console.error(`❌ Gửi giao dịch Commit lên L1 thất bại (${submitRes.status}):`, await submitRes.text())
  process.exit(1)
}

const txHash = await submitRes.text()
console.log(`\n🎉 ĐÃ COMMIT THÀNH CÔNG UTxO (${(chosen.lovelace / 1_000_000).toFixed(2)} ADA) VÀO HYDRA HEAD!`)
console.log(`🔗 L1 Commit TxHash: ${txHash.replace(/"/g, '')}`)
console.log('⏳ Chờ khoảng 20-30 giây để Cardano Preprod L1 xác nhận -> Head trên Hexcore sẽ tự động chuyển sang Open với đầy đủ Fuel UTxO!\n')
