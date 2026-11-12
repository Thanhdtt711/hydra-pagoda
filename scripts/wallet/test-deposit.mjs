// Kiểm thử Bước 3: Mua MC coin bằng ADA (@hydra-sdk/cardano-wasm + Blockfrost + Idempotent Ledger)
// Yêu cầu đã build: npm run build. Chạy: node scripts/wallet/test-deposit.mjs
// Mặc định test tự dựng server (cổng 3016) với NUXT_CONFIRMATIONS_REQUIRED=2 vì kịch bản giả định đúng 2 xác nhận.
// Đặt BASE_URL (và DB_PATH) để chạy với server có sẵn; khi đó server phải cấu hình 2 xác nhận.
import http from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { encode as cborEncode } from 'cbor2'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { startTestServer } from './_server.mjs'

const SPAWN = !process.env.BASE_URL
const PORT = Number(process.env.PORT || 3016)
const BASE = process.env.BASE_URL || `http://127.0.0.1:${PORT}`
const BF_PORT = Number(process.env.BF_PORT || 3099)
const DB_PATH = process.env.DB_PATH || (SPAWN ? './.data/test-deposit.sqlite' : undefined)
const results = []
const hex = b => Buffer.from(b).toString('hex')
const log = (name, ok, info = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${info ? ' — ' + info : ''}`)
}

// ============================================================================
// 1. Mock Blockfrost Indexer Server (mô phỏng chuỗi Cardano L1)
// ============================================================================
const chainState = {
  tipHeight: 100,
  txs: new Map() // txHash -> { blockHeight, blockTime, inputs, outputs, metadata }
}

const bfServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${BF_PORT}`)
  const path = url.pathname
  res.setHeader('content-type', 'application/json')

  if (path === '/blocks/latest') {
    res.end(JSON.stringify({ height: chainState.tipHeight }))
    return
  }

  const addrMatch = path.match(/^\/addresses\/([^/]+)\/transactions$/)
  if (addrMatch) {
    const addr = decodeURIComponent(addrMatch[1])
    const list = []
    for (const [hash, tx] of chainState.txs.entries()) {
      const touches =
        tx.inputs.some(i => i.address === addr) ||
        tx.outputs.some(o => o.address === addr)
      if (touches) {
        list.push({ tx_hash: hash, block_height: tx.blockHeight, block_time: tx.blockTime })
      }
    }
    res.end(JSON.stringify(list))
    return
  }

  const utxoMatch = path.match(/^\/txs\/([0-9a-fA-F]{64})\/utxos$/)
  if (utxoMatch) {
    const tx = chainState.txs.get(utxoMatch[1].toLowerCase())
    if (!tx) { res.statusCode = 404; res.end(JSON.stringify({ status_code: 404 })); return }
    res.end(JSON.stringify({
      hash: utxoMatch[1].toLowerCase(),
      inputs: tx.inputs.map(i => ({
        address: i.address,
        amount: [{ unit: 'lovelace', quantity: String(i.lovelace) }],
        collateral: !!i.collateral,
        reference: !!i.reference
      })),
      outputs: tx.outputs.map(o => ({
        address: o.address,
        amount: [{ unit: 'lovelace', quantity: String(o.lovelace) }]
      }))
    }))
    return
  }

  const metaMatch = path.match(/^\/txs\/([0-9a-fA-F]{64})\/metadata$/)
  if (metaMatch) {
    const tx = chainState.txs.get(metaMatch[1].toLowerCase())
    if (!tx) { res.statusCode = 404; res.end(JSON.stringify({ status_code: 404 })); return }
    res.end(JSON.stringify(tx.metadata || []))
    return
  }

  const txMatch = path.match(/^\/txs\/([0-9a-fA-F]{64})$/)
  if (txMatch) {
    const tx = chainState.txs.get(txMatch[1].toLowerCase())
    if (!tx) { res.statusCode = 404; res.end(JSON.stringify({ status_code: 404 })); return }
    res.end(JSON.stringify({
      hash: txMatch[1].toLowerCase(),
      block_height: tx.blockHeight,
      block_time: tx.blockTime
    }))
    return
  }

  res.statusCode = 404
  res.end(JSON.stringify({ status_code: 404 }))
})

await new Promise(resolve => bfServer.listen(BF_PORT, '127.0.0.1', resolve))

const testServer = SPAWN
  ? await startTestServer({
      port: PORT,
      dbPath: DB_PATH,
      env: {
        NUXT_CONFIRMATIONS_REQUIRED: '2',
        NUXT_BLOCKFROST_BASE_URL: `http://127.0.0.1:${BF_PORT}`
      }
    })
  : null

try {
  // ============================================================================
  // 2. Tạo ví Cardano thật bằng @noble & @hydra-sdk/cardano-wasm, đăng nhập CIP-8
  // ============================================================================
  const skBytes = ed25519.utils.randomPrivateKey()
  const wasmPrivKey = C.PrivateKey.from_normal_bytes(skBytes)
  const pkBytes = wasmPrivKey.to_public().as_bytes()
  const keyHash = blake2b(pkBytes, { dkLen: 28 })
  const addrBytes = new Uint8Array(29)
  addrBytes[0] = 0x60 // Enterprise testnet (networkId = 0)
  addrBytes.set(keyHash, 1)
  const userBech32 = bech32.encode('addr_test', bech32.toWords(addrBytes), 1023)

  function signCip8(payloadBytes) {
    const protectedBytes = cborEncode(new Map([[1, -8], ['address', addrBytes]]))
    const sigStructure = cborEncode(['Signature1', protectedBytes, new Uint8Array(0), payloadBytes])
    const sig = ed25519.sign(sigStructure, skBytes)
    const signature = cborEncode([protectedBytes, new Map([['hashed', false]]), payloadBytes, sig])
    const key = cborEncode(new Map([[1, 1], [3, -8], [-1, 6], [-2, pkBytes]]))
    return { signature: hex(signature), key: hex(key) }
  }

  async function api(path, { method = 'GET', body, cookie } = {}) {
    const headers = { 'content-type': 'application/json', origin: BASE }
    if (cookie) headers.cookie = cookie
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    let json = null
    try { json = await res.json() } catch {}
    return { status: res.status, json, setCookie: res.headers.get('set-cookie') }
  }

  const nonceRes = await api('/api/auth/nonce', { method: 'POST', body: { address: userBech32 } })
  const signedLogin = signCip8(new TextEncoder().encode(nonceRes.json.message))
  const verifyRes = await api('/api/auth/verify', {
    method: 'POST',
    body: { address: userBech32, nonce: nonceRes.json.nonce, ...signedLogin }
  })
  const cookie = verifyRes.setCookie.split(';')[0]
  log('Đăng nhập ví Eternl trên Preprod thành công', verifyRes.status === 200, userBech32.slice(0, 20) + '...')

  // Tạo một UTxO 100 ADA hợp lệ bằng @hydra-sdk/cardano-wasm cho ví người chơi
  function makeWalletUtxoHex(lovelaceStr = '100000000', txHexId = '11'.repeat(32), index = 0) {
    const input = C.TransactionInput.new(C.TransactionHash.from_hex(txHexId), index)
    const output = C.TransactionOutput.new(
      C.Address.from_bech32(userBech32),
      C.Value.new(C.BigNum.from_str(lovelaceStr))
    )
    return C.TransactionUnspentOutput.new(input, output).to_hex()
  }

  // ============================================================================
  // 3. Kiểm tra tạo đơn & chặn giá trị không hợp lệ (< 2 ADA, số thực, âm)
  // ============================================================================
  const tooSmall = await api('/api/shop/orders', { method: 'POST', cookie, body: { adaAmount: 1 } })
  log('Từ chối đơn dưới mức tối thiểu (< 2 ADA)', tooSmall.status === 400, `status=${tooSmall.status}`)

  const floatAda = await api('/api/shop/orders', { method: 'POST', cookie, body: { adaAmount: 2.5 } })
  log('Từ chối số thực (float 2.5 ADA) tránh sai số', floatAda.status === 400, `status=${floatAda.status}`)

  const ord5 = await api('/api/shop/orders', { method: 'POST', cookie, body: { adaAmount: 5 } })
  const order1 = ord5.json?.order
  log(
    'Tạo đơn 5 ADA -> trả đúng 5.000.000 lovelace & 5.000 MC',
    ord5.status === 200 && order1?.expectedLovelace === 5_000_000 && order1?.expectedMc === 5_000,
    `orderId=${order1?.orderId}`
  )

  // ============================================================================
  // 4. Dựng giao dịch bằng @hydra-sdk/cardano-wasm & kiểm tra đầu ra + metadata
  // ============================================================================
  const utxoHex = makeWalletUtxoHex('100000000')
  const builtRes = await api(`/api/shop/orders/${order1.orderId}/build`, {
    method: 'POST',
    cookie,
    body: { utxos: [utxoHex], changeAddress: userBech32 }
  })
  log(
    'Server dựng unsigned tx bằng @hydra-sdk/cardano-wasm thành công',
    builtRes.status === 200 && typeof builtRes.json?.unsignedTxCbor === 'string' && builtRes.json?.txHash?.length === 64,
    `txHash=${builtRes.json?.txHash?.slice(0, 16)}..., fee=${builtRes.json?.feeLovelace}`
  )

  // Giải mã lại unsignedTxCbor bằng @hydra-sdk/cardano-wasm để kiểm chứng output & metadata
  const parsedTx = C.Transaction.from_hex(builtRes.json.unsignedTxCbor)
  const out0 = parsedTx.body().outputs().get(0)
  const out0Addr = out0.address().to_bech32()
  const out0Coin = Number(out0.amount().coin().to_str())
  log(
    'Giao dịch dựng ra trả đúng 5.000.000 lovelace tới treasuryAddress',
    out0Addr === order1.treasuryAddress && out0Coin === 5_000_000,
    `${out0Coin} lovelace -> ${out0Addr.slice(0, 18)}...`
  )

  // ============================================================================
  // 5. Ký giao dịch (CIP-30 signTx) & chặn tráo đổi giao dịch khi ghép witness
  // ============================================================================
  // Thử tấn công: ký một giao dịch giả khác rồi gửi witness lên
  const fakeHash = C.TransactionHash.from_hex('aa'.repeat(32))
  const fakeWitSet = C.TransactionWitnessSet.new()
  const fakeVkeys = C.Vkeywitnesses.new()
  fakeVkeys.add(C.make_vkey_witness(fakeHash, wasmPrivKey))
  fakeWitSet.set_vkeys(fakeVkeys)
  const fakeTx = C.Transaction.new(parsedTx.body(), fakeWitSet, parsedTx.auxiliary_data())
  // Tráo body khác (ví dụ đổi TTL) để txHash lệch
  const tamperedBody = C.TransactionBody.new(parsedTx.body().inputs(), parsedTx.body().outputs(), parsedTx.body().fee(), 999999)
  const tamperedTx = C.Transaction.new(tamperedBody, fakeWitSet, undefined)
  const tamperedRes = await api(`/api/shop/orders/${order1.orderId}/witness`, {
    method: 'POST',
    cookie,
    body: { witnessHex: tamperedTx.to_hex() }
  })
  log('Chặn tráo đổi nội dung giao dịch khi gửi witness (tx_hash_mismatch)', tamperedRes.status === 400, `status=${tamperedRes.status}`)

  // Ký thật bằng khóa ví người chơi
  const realTxHash = C.FixedTransaction.from_hex(builtRes.json.unsignedTxCbor).transaction_hash()
  const witSet = C.TransactionWitnessSet.new()
  const vkeys = C.Vkeywitnesses.new()
  vkeys.add(C.make_vkey_witness(realTxHash, wasmPrivKey))
  witSet.set_vkeys(vkeys)

  const witRes = await api(`/api/shop/orders/${order1.orderId}/witness`, {
    method: 'POST',
    cookie,
    body: { witnessHex: witSet.to_hex() }
  })
  log(
    'Ghép witness chữ ký CIP-30 bằng @hydra-sdk/cardano-wasm khớp txHash',
    witRes.status === 200 && witRes.json?.txHash === builtRes.json.txHash
  )

  // ============================================================================
  // 6. Gửi txHash -> Chưa đủ xác nhận thì TUYỆT ĐỐI chưa cộng MC
  // ============================================================================
  const txHash1 = builtRes.json.txHash
  const subRes = await api(`/api/shop/orders/${order1.orderId}/submit`, {
    method: 'POST',
    cookie,
    body: { txHash: txHash1 }
  })
  log(
    'Sau khi submitTx (chưa lên chuỗi): trạng thái submitted, số dư MC vẫn = 0',
    subRes.status === 200 && subRes.json?.order?.status === 'submitted' && subRes.json?.account?.mcBalance === 0
  )

  // Đưa giao dịch lên chuỗi ở block 100, trong khi tip = 100 => mới có 1/2 xác nhận
  chainState.tipHeight = 100
  chainState.txs.set(txHash1, {
    blockHeight: 100,
    blockTime: Math.floor(Date.now() / 1000),
    inputs: [{ address: userBech32, lovelace: 100_000_000 }],
    outputs: [
      { address: order1.treasuryAddress, lovelace: 5_000_000 },
      { address: userBech32, lovelace: 94_800_000 }
    ],
    metadata: [{ label: '8181', json_metadata: { v: 1, app: 'hydra-pagoda', orderId: order1.orderId } }]
  })

  const check1 = await api(`/api/shop/orders/${order1.orderId}`, { cookie })
  log(
    'Khi mới có 1/2 xác nhận: trạng thái confirming (1/2), CHƯA cộng MC (mcBalance = 0)',
    check1.json?.order?.status === 'confirming' &&
      check1.json?.order?.confirmations === 1 &&
      check1.json?.account?.mcBalance === 0,
    `confirmations=${check1.json?.order?.confirmations}/${check1.json?.order?.confirmationsRequired}`
  )

  // ============================================================================
  // 7. Đạt đủ xác nhận (2/2) -> Cộng đúng 5.000 MC + Chống cộng trùng khi gọi lặp
  // ============================================================================
  chainState.tipHeight = 101 // confirmations = 101 - 100 + 1 = 2 >= 2
  const wh1 = await api('/api/shop/webhook/blockfrost', {
    method: 'POST',
    body: { txHash: txHash1 }
  })
  const meAfter1 = await api('/api/auth/me', { cookie })
  log(
    'Đạt 2/2 xác nhận: cộng nguyên tử đúng +5.000 MC vào tài khoản',
    wh1.status === 200 &&
      wh1.json?.results?.[0]?.action === 'completed' &&
      meAfter1.json?.account?.mcBalance === 5_000,
    `mcBalance=${meAfter1.json?.account?.mcBalance}`
  )

  // Gửi lại webhook & poll thêm 3 lần với cùng txHash1 -> Không bao giờ cộng trùng
  await api('/api/shop/webhook/blockfrost', { method: 'POST', body: { txHash: txHash1 } })
  await api('/api/shop/webhook/blockfrost', { method: 'POST', body: { payload: [{ tx: { hash: txHash1 } }] } })
  const checkDup = await api(`/api/shop/orders/${order1.orderId}`, { cookie })
  log(
    'Idempotent: gửi lại webhook/poll nhiều lần KHÔNG cộng trùng (vẫn 5.000 MC)',
    checkDup.json?.account?.mcBalance === 5_000 && checkDup.json?.order?.status === 'completed',
    `mcBalance=${checkDup.json?.account?.mcBalance}`
  )

  // ============================================================================
  // 8. Ca đặc biệt: Trả thiếu tiền (Underpaid) -> Từ chối cộng MC
  // ============================================================================
  const ordUnder = (await api('/api/shop/orders', { method: 'POST', cookie, body: { adaAmount: 10 } })).json.order
  const txHashUnder = '22'.repeat(32)
  await api(`/api/shop/orders/${ordUnder.orderId}/submit`, { method: 'POST', cookie, body: { txHash: txHashUnder } })
  chainState.txs.set(txHashUnder, {
    blockHeight: 100,
    blockTime: Math.floor(Date.now() / 1000),
    inputs: [{ address: userBech32, lovelace: 10_000_000 }],
    outputs: [{ address: ordUnder.treasuryAddress, lovelace: 4_000_000 }], // Chỉ trả 4 ADA thay vì 10 ADA
    metadata: [{ label: '8181', json_metadata: { v: 1, orderId: ordUnder.orderId } }]
  })
  const checkUnder = await api(`/api/shop/orders/${ordUnder.orderId}`, { cookie })
  log(
    'Chặn trả thiếu (đơn 10 ADA nhưng chỉ gửi 4 ADA): đánh dấu underpaid, +0 MC',
    checkUnder.json?.order?.status === 'underpaid' && checkUnder.json?.account?.mcBalance === 5_000,
    `status=${checkUnder.json?.order?.status}`
  )

  // ============================================================================
  // 9. Ca đặc biệt: Trả thừa tiền -> Tính MC theo số lovelace thực nhận
  // ============================================================================
  const ordOver = (await api('/api/shop/orders', { method: 'POST', cookie, body: { adaAmount: 5 } })).json.order
  const txHashOver = '33'.repeat(32)
  await api(`/api/shop/orders/${ordOver.orderId}/submit`, { method: 'POST', cookie, body: { txHash: txHashOver } })
  chainState.txs.set(txHashOver, {
    blockHeight: 100,
    blockTime: Math.floor(Date.now() / 1000),
    inputs: [{ address: userBech32, lovelace: 10_000_000 }],
    outputs: [{ address: ordOver.treasuryAddress, lovelace: 7_500_000 }], // Trả 7.5 ADA cho đơn 5 ADA
    metadata: [{ label: '8181', json_metadata: { v: 1, orderId: ordOver.orderId } }]
  })
  const checkOver = await api(`/api/shop/orders/${ordOver.orderId}`, { cookie })
  log(
    'Trả thừa (7.5 ADA cho đơn 5 ADA): cộng đúng +7.500 MC theo lovelace thực nhận',
    checkOver.json?.order?.status === 'completed' &&
      checkOver.json?.order?.creditedMc === 7_500 &&
      checkOver.json?.account?.mcBalance === 12_500,
    `creditedMc=${checkOver.json?.order?.creditedMc}, totalMc=${checkOver.json?.account?.mcBalance}`
  )

  // ============================================================================
  // 10. Tấn công giả mạo: Gắn txHash có metadata orderId khác vào đơn 100 ADA
  // ============================================================================
  const ordSpoof = (await api('/api/shop/orders', { method: 'POST', cookie, body: { adaAmount: 100 } })).json.order
  const txHashSpoof = '44'.repeat(32)
  await api(`/api/shop/orders/${ordSpoof.orderId}/submit`, { method: 'POST', cookie, body: { txHash: txHashSpoof } })
  chainState.txs.set(txHashSpoof, {
    blockHeight: 100,
    blockTime: Math.floor(Date.now() / 1000),
    inputs: [{ address: userBech32, lovelace: 200_000_000 }],
    outputs: [{ address: ordSpoof.treasuryAddress, lovelace: 100_000_000 }],
    metadata: [{ label: '8181', json_metadata: { v: 1, orderId: 'ord_fake_someone_else' } }]
  })
  const whSpoof = await api('/api/shop/webhook/blockfrost', {
    method: 'POST',
    body: { txHash: txHashSpoof, orderId: ordSpoof.orderId }
  })
  const meAfterSpoof = await api('/api/auth/me', { cookie })
  log(
    'Chặn giả mạo metadata orderId khác: trả về metadata_mismatch, không cộng MC',
    whSpoof.json?.results?.[0]?.action === 'metadata_mismatch' && meAfterSpoof.json?.account?.mcBalance === 12_500
  )

  // ============================================================================
  // 11. Ca đặc biệt: Đơn đã hết hạn mà vẫn có tiền về -> Ghi vào đối soát thủ công
  // ============================================================================
  const ordExp = (await api('/api/shop/orders', { method: 'POST', cookie, body: { adaAmount: 5 } })).json.order
  if (DB_PATH) {
    const db = new DatabaseSync(DB_PATH)
    db.prepare("UPDATE mc_orders SET expires_at = ?, status = 'expired' WHERE order_id = ?").run(Date.now() - 60_000, ordExp.orderId)
    db.close()
  }
  const txHashExp = '55'.repeat(32)
  chainState.txs.set(txHashExp, {
    blockHeight: 100,
    blockTime: Math.floor(Date.now() / 1000),
    inputs: [{ address: userBech32, lovelace: 10_000_000 }],
    outputs: [{ address: ordExp.treasuryAddress, lovelace: 5_000_000 }],
    metadata: [{ label: '8181', json_metadata: { v: 1, orderId: ordExp.orderId } }]
  })
  const whExp = await api('/api/shop/webhook/blockfrost', { method: 'POST', body: { txHash: txHashExp } })
  const checkExp = await api(`/api/shop/orders/${ordExp.orderId}`, { cookie })
  log(
    'Đơn hết hạn vẫn có tiền về: ghi nhận expired_paid để đối soát thủ công, chưa tự cộng MC',
    whExp.json?.results?.[0]?.action === 'expired_paid' &&
      checkExp.json?.order?.status === 'expired_paid' &&
      checkExp.json?.account?.mcBalance === 12_500
  )

  // ============================================================================
  // 12. Ca đặc biệt: Giao dịch bị Rollback (Reorg) khi đang confirming (1/2)
  // ============================================================================
  const ordReorg = (await api('/api/shop/orders', { method: 'POST', cookie, body: { adaAmount: 5 } })).json.order
  const txHashReorg = '66'.repeat(32)
  await api(`/api/shop/orders/${ordReorg.orderId}/submit`, { method: 'POST', cookie, body: { txHash: txHashReorg } })
  chainState.tipHeight = 200
  chainState.txs.set(txHashReorg, {
    blockHeight: 200, // 1/2 xác nhận
    blockTime: Math.floor(Date.now() / 1000),
    inputs: [{ address: userBech32, lovelace: 10_000_000 }],
    outputs: [{ address: ordReorg.treasuryAddress, lovelace: 5_000_000 }],
    metadata: [{ label: '8181', json_metadata: { v: 1, orderId: ordReorg.orderId } }]
  })
  const preReorg = await api(`/api/shop/orders/${ordReorg.orderId}`, { cookie })
  // Xóa giao dịch khỏi chuỗi (mô phỏng rollback nhánh)
  chainState.txs.delete(txHashReorg)
  const postReorg = await api(`/api/shop/orders/${ordReorg.orderId}`, { cookie })
  log(
    'Xử lý Rollback (Reorg) trước khi đủ xác nhận: đưa về submitted (confirmations=0), không mất/lệch MC',
    preReorg.json?.order?.status === 'confirming' &&
      postReorg.json?.order?.status === 'submitted' &&
      postReorg.json?.order?.confirmations === 0 &&
      postReorg.json?.account?.mcBalance === 12_500
  )

  // ============================================================================
  // 13. Ca đặc biệt: Người chơi đóng tab ngay khi ví submitTx (chưa kịp gọi /submit)
  //     Khi quay lại mở danh sách đơn -> Server tự quét treasuryAddress & cộng MC
  // ============================================================================
  const ordClosedTab = (await api('/api/shop/orders', { method: 'POST', cookie, body: { adaAmount: 5 } })).json.order
  await api(`/api/shop/orders/${ordClosedTab.orderId}/build`, {
    method: 'POST',
    cookie,
    body: { utxos: [utxoHex], changeAddress: userBech32 }
  })
  const txHashClosed = '77'.repeat(32)
  chainState.tipHeight = 210
  chainState.txs.set(txHashClosed, {
    blockHeight: 205, // 6 xác nhận >= 2
    blockTime: Math.floor(Date.now() / 1000),
    inputs: [{ address: userBech32, lovelace: 10_000_000 }],
    outputs: [{ address: ordClosedTab.treasuryAddress, lovelace: 5_000_000 }],
    metadata: [{ label: '8181', json_metadata: { v: 1, orderId: ordClosedTab.orderId } }]
  })
  // Người chơi mở lại trang -> gọi GET /api/shop/orders
  const listAfterReturn = await api('/api/shop/orders', { cookie })
  const recovered = listAfterReturn.json?.orders?.find(o => o.orderId === ordClosedTab.orderId)
  log(
    'Đóng trang giữa chừng: khi quay lại GET /api/shop/orders tự quét chuỗi và cộng +5.000 MC',
    recovered?.status === 'completed' &&
      recovered?.creditedMc === 5_000 &&
      listAfterReturn.json?.account?.mcBalance === 17_500,
    `totalMc=${listAfterReturn.json?.account?.mcBalance}`
  )

  // ============================================================================
  // 14. Đối soát Sổ cái (mc_ledger) khớp tuyệt đối với accounts.mc_balance
  // ============================================================================
  if (DB_PATH) {
    const db = new DatabaseSync(DB_PATH)
    const acc = db.prepare('SELECT id, mc_balance FROM accounts WHERE address = ?').get(userBech32)
    const sumRow = db.prepare('SELECT COALESCE(SUM(delta_mc), 0) AS total FROM mc_ledger WHERE account_id = ?').get(acc.id)
    const ledgerCount = db.prepare('SELECT COUNT(*) AS cnt FROM mc_ledger WHERE account_id = ?').get(acc.id)
    db.close()
    log(
      'Bất biến Sổ cái (mc_ledger): SUM(delta_mc) === accounts.mc_balance (17.500 MC / 3 bút toán)',
      acc.mc_balance === 17_500 && sumRow.total === 17_500 && ledgerCount.cnt === 3,
      `balance=${acc.mc_balance}, ledgerSum=${sumRow.total}, entries=${ledgerCount.cnt}`
    )
  }
} finally {
  bfServer.close()
  await testServer?.stop()
}

const failed = results.filter(r => !r.ok).length
console.log(`\nKẾT QUẢ BƯỚC 3: ${results.length - failed}/${results.length} đạt`)
process.exit(failed ? 1 : 0)

