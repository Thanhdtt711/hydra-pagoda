// Kiểm thử Bước 4: Dịch vụ ví nội bộ MC (spend nguyên tử, idempotency, Cửa hàng, Bói quẻ, Công đức, chống race condition)
// Chạy: node scripts/wallet/test-spend.mjs
import http from 'node:http'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { encode as cborEncode } from 'cbor2'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'

const PORT = Number(process.env.PORT || 3014)
const BASE = process.env.BASE_URL || `http://127.0.0.1:${PORT}`
const BF_PORT = Number(process.env.BF_PORT || 3098)
const DB_PATH = process.env.DB_PATH || './.data/test-spend.sqlite'
const TREASURY_TEST_ADDR =
  'addr_test1qqn4u45fks9kd0jk7tgqrwcnkcds8cqyyzcuqkzp73yh84fcrse0mymwzap6e9vvwt9yv3wddg28lft4p7hszvpyucjstn9ug9'
const results = []
const hex = b => Buffer.from(b).toString('hex')
const log = (name, ok, info = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${info ? ' — ' + info : ''}`)
}

// ============================================================================
// 1. Mock Blockfrost Indexer để nạp MC ban đầu cho tài khoản test
// ============================================================================
const chainState = {
  tipHeight: 200,
  txs: new Map()
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
        collateral: false,
        reference: false
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

let serverProc = null
for (const ext of ['', '-wal', '-shm']) {
  try { fs.unlinkSync(DB_PATH + ext) } catch {}
}

serverProc = spawn(process.execPath, ['.output/server/index.mjs'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    NUXT_DB_PATH: DB_PATH,
    NUXT_TREASURY_ADDRESS: TREASURY_TEST_ADDR,
    NUXT_BLOCKFROST_API_KEY: 'preprod_mock_key_spend',
    NUXT_BLOCKFROST_BASE_URL: `http://127.0.0.1:${BF_PORT}`,
    NUXT_CONFIRMATIONS_REQUIRED: '1'
  },
  stdio: ['ignore', 'pipe', 'pipe']
})

for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`${BASE}/api/auth/me`)
    if (r.status === 200) break
  } catch {}
  await new Promise(r => setTimeout(r, 150))
}

try {
  // ============================================================================
  // 2. Tạo ví Cardano test & đăng nhập CIP-8
  // ============================================================================
  const skBytes = ed25519.utils.randomPrivateKey()
  const wasmPrivKey = C.PrivateKey.from_normal_bytes(skBytes)
  const pkBytes = wasmPrivKey.to_public().as_bytes()
  const keyHash = blake2b(pkBytes, { dkLen: 28 })
  const addrBytes = new Uint8Array(29)
  addrBytes[0] = 0x60
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
  log(
    '1. Đăng nhập ví Cardano Preprod CIP-8 (mcBalance khởi tạo = 0)',
    verifyRes.status === 200 && verifyRes.json?.account?.mcBalance === 0,
    `addr=${verifyRes.json?.account?.addressShort}`
  )

  // ============================================================================
  // 3. Test 2: GET /api/mc/catalog trả đầy đủ danh mục từ server
  // ============================================================================
  const catRes = await api('/api/mc/catalog', { cookie })
  const fortuneTierCount = catRes.json?.fortuneTiers ? Object.keys(catRes.json.fortuneTiers).length : 0
  log(
    '2. GET /api/mc/catalog trả cấu hình dịch vụ, vật phẩm, cấp độ quẻ, bảng công đức',
    catRes.status === 200 &&
      Array.isArray(catRes.json?.shopCatalog) &&
      catRes.json.shopCatalog.length >= 15 &&
      fortuneTierCount === 3,
    `shop=${catRes.json?.shopCatalog?.length} items, fortuneTiers=${fortuneTierCount}`
  )

  // ============================================================================
  // 4. Test 3: Chặn tiêu MC khi chưa đăng nhập (401)
  // ============================================================================
  const unauthBuy = await api('/api/mc/shop/buy', {
    method: 'POST',
    body: { itemId: 'thailand', requestId: 'req_unauth_0001' }
  })
  log('3. Từ chối tiêu MC khi không có phiên đăng nhập (401)', unauthBuy.status === 401, `status=${unauthBuy.status}`)

  // ============================================================================
  // 5. Test 4: Từ chối tiêu MC khi không đủ số dư (400 insufficient_mc_balance)
  // ============================================================================
  const noFundBuy = await api('/api/mc/shop/buy', {
    method: 'POST',
    cookie,
    body: { itemId: 'thailand', requestId: 'req_nofund_0001' }
  })
  log(
    '4. Từ chối mua đồ khi số dư MC = 0 < 800 MC (400 insufficient_mc_balance)',
    noFundBuy.status === 400 && noFundBuy.json?.data?.code === 'insufficient_mc_balance',
    `code=${noFundBuy.json?.data?.code}`
  )

  // ============================================================================
  // 6. Test 5: Nạp 2 ADA -> nhận +2,000 MC để kiểm thử tiêu MC
  // ============================================================================
  const ordRes = await api('/api/shop/orders', {
    method: 'POST',
    cookie,
    body: { adaAmount: 2 }
  })
  const order = ordRes.json?.order
  const depositTxHash = 'e'.repeat(63) + '1'
  chainState.txs.set(depositTxHash, {
    blockHeight: 199,
    blockTime: Math.floor(Date.now() / 1000),
    inputs: [{ address: userBech32, lovelace: 5_000_000 }],
    outputs: [
      { address: order.treasuryAddress, lovelace: 2_000_000 },
      { address: userBech32, lovelace: 2_820_000 }
    ],
    metadata: [{ label: '8181', json_metadata: { v: 1, app: 'hydra-pagoda', orderId: order.orderId } }]
  })

  await api(`/api/shop/orders/${order.orderId}/submit`, {
    method: 'POST',
    cookie,
    body: { txHash: depositTxHash }
  })
  const depCheckRes = await api(`/api/shop/orders/${order.orderId}`, { cookie })
  log(
    '5. Nạp 2 ADA trên chuỗi -> Tài khoản nhận +2,000 MC',
    depCheckRes.json?.order?.status === 'completed' && depCheckRes.json?.account?.mcBalance === 2000,
    `mcBalance=${depCheckRes.json?.account?.mcBalance}`
  )

  // ============================================================================
  // 7. Test 6: Mua cổ phục Thái Lan (800 MC) -> trừ đúng 800 MC (còn 1,200 MC) & ghi kho đồ
  // ============================================================================
  const buyReqId = 'req_shop_thailand_0001'
  const buyRes = await api('/api/mc/shop/buy', {
    method: 'POST',
    cookie,
    body: { itemId: 'thailand', requestId: buyReqId }
  })
  const ownsThailand =
    Array.isArray(buyRes.json?.inventory) && buyRes.json.inventory.some(i => i.itemId === 'thailand' && i.quantity === 1)
  log(
    '6. Mua cổ phục Thái Lan (-800 MC) nguyên tử -> mcBalance = 1,200 & lưu kho đồ',
    buyRes.status === 200 && buyRes.json?.mcBalance === 1200 && ownsThailand && buyRes.json?.idempotentReplay === false,
    `mcBalance=${buyRes.json?.mcBalance}, ownsThailand=${ownsThailand}`
  )

  // ============================================================================
  // 8. Test 7: Idempotency mua hàng — gửi lặp cùng requestId không trừ lần 2
  // ============================================================================
  const replayBuyRes = await api('/api/mc/shop/buy', {
    method: 'POST',
    cookie,
    body: { itemId: 'thailand', requestId: buyReqId }
  })
  log(
    '7. Idempotency Cửa hàng: gửi lặp cùng requestId trả idempotentReplay=true, số dư giữ nguyên 1,200 MC',
    replayBuyRes.status === 200 && replayBuyRes.json?.idempotentReplay === true && replayBuyRes.json?.mcBalance === 1200,
    `idempotentReplay=${replayBuyRes.json?.idempotentReplay}, mcBalance=${replayBuyRes.json?.mcBalance}`
  )

  // ============================================================================
  // 9. Test 8: Chặn mua lại cổ phục không cộng dồn đã sở hữu (400 already_owned)
  // ============================================================================
  const dupBuyRes = await api('/api/mc/shop/buy', {
    method: 'POST',
    cookie,
    body: { itemId: 'thailand', requestId: 'req_shop_thailand_0002' }
  })
  log(
    '8. Chặn mua lại cổ phục đã sở hữu với requestId mới (400 already_owned)',
    dupBuyRes.status === 400 && dupBuyRes.json?.data?.code === 'already_owned',
    `code=${dupBuyRes.json?.data?.code}`
  )

  // ============================================================================
  // 10. Test 9: Mua vật phẩm lễ phẩm cộng dồn (Trầm Hương Xứ Quảng 50 MC x 2 lần)
  // ============================================================================
  await api('/api/mc/shop/buy', {
    method: 'POST',
    cookie,
    body: { itemId: 'incense_quang', requestId: 'req_incense_0001' }
  })
  const incRes2 = await api('/api/mc/shop/buy', {
    method: 'POST',
    cookie,
    body: { itemId: 'incense_quang', requestId: 'req_incense_0002' }
  })
  const incenseItem = incRes2.json?.inventory?.find(i => i.itemId === 'incense_quang')
  log(
    '9. Mua vật phẩm lễ phẩm cộng dồn (50 MC x 2) -> quantity = 2, mcBalance = 1,100 MC',
    incRes2.status === 200 && incRes2.json?.mcBalance === 1100 && incenseItem?.quantity === 2,
    `quantity=${incenseItem?.quantity}, mcBalance=${incRes2.json?.mcBalance}`
  )

  // ============================================================================
  // 11. Test 10: Gieo quẻ Cát Tường (50 MC) sinh kết quả ở server & lưu lịch sử
  // ============================================================================
  const fortuneReqId = 'req_fortune_golden_0001'
  const fortRes = await api('/api/mc/fortune/draw', {
    method: 'POST',
    cookie,
    body: { category: 'wealth', tier: 'golden', requestId: fortuneReqId }
  })
  log(
    '10. Gieo quẻ Cát Tường (-50 MC) sinh kết quả ở server -> mcBalance = 1,050 MC',
    fortRes.status === 200 &&
      fortRes.json?.mcBalance === 1050 &&
      Boolean(fortRes.json?.fortune?.title) &&
      fortRes.json?.fortune?.costMc === 50 &&
      fortRes.json?.idempotentReplay === false,
    `title="${fortRes.json?.fortune?.title}", mcBalance=${fortRes.json?.mcBalance}`
  )

  // ============================================================================
  // 12. Test 11: Idempotency Gieo quẻ — gửi lặp cùng requestId trả lại đúng quẻ đã gieo
  // ============================================================================
  const fortReplayRes = await api('/api/mc/fortune/draw', {
    method: 'POST',
    cookie,
    body: { category: 'wealth', tier: 'golden', requestId: fortuneReqId }
  })
  log(
    '11. Idempotency Gieo quẻ: gửi lặp requestId trả lại đúng quẻ cũ, không trừ thêm MC',
    fortReplayRes.status === 200 &&
      fortReplayRes.json?.idempotentReplay === true &&
      fortReplayRes.json?.mcBalance === 1050 &&
      fortReplayRes.json?.fortune?.id === fortRes.json?.fortune?.id,
    `fortuneId=${fortReplayRes.json?.fortune?.id}, mcBalance=${fortReplayRes.json?.mcBalance}`
  )

  // ============================================================================
  // 13. Test 12: Công đức 550 MC -> trừ 550 MC (còn 500 MC), tặng Hoa Đăng & cập nhật bảng công đức
  // ============================================================================
  const meritReqId = 'req_merit_500_0001'
  const meritRes = await api('/api/mc/merit/donate', {
    method: 'POST',
    cookie,
    body: {
      amountMc: 550,
      prayer: 'Cầu quốc thái dân an, mưa thuận gió hòa',
      requestId: meritReqId
    }
  })
  const hasLantern = meritRes.json?.inventory?.some(i => i.itemId === 'lotus_lantern' && i.quantity >= 1)
  log(
    '12. Hòm công đức (-550 MC) -> mcBalance = 500 MC, tặng Hoa Đăng Cầu An & ghi sổ vàng',
    meritRes.status === 200 &&
      meritRes.json?.mcBalance === 500 &&
      meritRes.json?.donation?.rewardItemId === 'lotus_lantern' &&
      hasLantern &&
      meritRes.json?.globalMeritTotal >= 550,
    `mcBalance=${meritRes.json?.mcBalance}, reward=${meritRes.json?.donation?.rewardItemId}`
  )

  // ============================================================================
  // 14. Test 13: Race condition / Concurrency — bắn đồng thời 10 request tiêu 200 MC khi số dư chỉ còn 500 MC
  // Chỉ tối đa 2 request được phép thành công (2 x 200 = 400 MC, còn dư 100 MC), 8 request phải bị từ chối!
  // ============================================================================
  const concurrentPromises = Array.from({ length: 10 }, (_, idx) =>
    api('/api/mc/merit/donate', {
      method: 'POST',
      cookie,
      body: {
        amountMc: 200,
        prayer: `Concurrent race test #${idx + 1}`,
        requestId: `req_race_test_${idx + 1}_${Date.now()}`
      }
    })
  )

  const raceResults = await Promise.all(concurrentPromises)
  const succeeded = raceResults.filter(r => r.status === 200)
  const rejected = raceResults.filter(r => r.status === 400 && r.json?.data?.code === 'insufficient_mc_balance')

  log(
    '13. Chống Race Condition (10 luồng tiêu 200 MC khi số dư = 500 MC): đúng 2 thành công, 8 bị từ chối, số dư = 100 MC (không âm)',
    succeeded.length === 2 && rejected.length === 8,
    `succeeded=${succeeded.length}, rejected=${rejected.length}`
  )

  // ============================================================================
  // 15. Test 14: Đối soát bất biến Sổ cái SQLite (SUM(delta_mc) === accounts.mc_balance === 100)
  // ============================================================================
  if (DB_PATH) {
    const db = new DatabaseSync(DB_PATH, { readOnly: true })
    const acc = db.prepare('SELECT id, mc_balance FROM accounts WHERE address = ?').get(userBech32)
    const ledgerAgg = db.prepare('SELECT COALESCE(SUM(delta_mc), 0) AS sum_mc, COUNT(*) AS cnt FROM mc_ledger WHERE account_id = ?').get(acc.id)
    db.close()

    log(
      '14. Đối soát Sổ cái SQLite bất biến: SUM(mc_ledger.delta_mc) === accounts.mc_balance === 100 MC',
      Number(acc.mc_balance) === 100 && Number(ledgerAgg.sum_mc) === 100 && Number(ledgerAgg.cnt) === 8,
      `mc_balance=${acc.mc_balance}, sum(delta_mc)=${ledgerAgg.sum_mc}, entries=${ledgerAgg.cnt}`
    )
  }
} finally {
  bfServer.close()
  if (serverProc) {
    serverProc.kill()
  }
  await new Promise(r => setTimeout(r, 200))
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(DB_PATH + ext) } catch {}
  }
}

const failed = results.filter(r => !r.ok)
console.log(`\n📊 Tổng kết Bước 4: ${results.length - failed.length}/${results.length} test cases PASS`)
if (failed.length > 0) process.exit(1)
