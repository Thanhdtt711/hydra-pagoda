// Kiểm thử Hybrid Hydra L2 cho MC Coin (dùng mock hydra-node WebSocket, không cần hydra-node thật).
// Kịch bản: nạp +2000 MC, gieo quẻ -50 MC, cúng dường -50 MC => 3 bút toán được phản chiếu lên Head,
// đối chiếu số dư SQLite với inline datum của State UTxO trên L2, kiểm tra fallback khi hydra-node sập.
// Yêu cầu: đã `npm run build` (có .output/server/index.mjs).
// Chạy: node scripts/wallet/test-hydra-l2.mjs
import http from 'node:http'
import fs from 'node:fs'
import { createHmac } from 'node:crypto'
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { encode as cborEncode } from 'cbor2'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { createHydraMock } from '../hydra-mock-server.mjs'

const PORT = Number(process.env.PORT || 3016)
const BASE = `http://127.0.0.1:${PORT}`
const BF_PORT = Number(process.env.BF_PORT || 3096)
const HYDRA_PORT = Number(process.env.HYDRA_PORT || 4011)
const DB_PATH = process.env.DB_PATH || './.data/test-hydra-l2.sqlite'
const SECRET = 'test-hydra-l2-secret-0123456789'
const TREASURY_TEST_ADDR =
    'addr_test1qqn4u45fks9kd0jk7tgqrwcnkcds8cqyyzcuqkzp73yh84fcrse0mymwzap6e9vvwt9yv3wddg28lft4p7hszvpyucjstn9ug9'
const results = []
const hex = b => Buffer.from(b).toString('hex')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (name, ok, info = '') => {
    results.push({ name, ok })
    console.log(`${ok ? '✅ PASS' : '❌ FAIL'} ${name}${info ? ' — ' + info : ''}`)
}
async function waitFor(fn, timeoutMs = 8000, stepMs = 100) {
    const end = Date.now() + timeoutMs
    while (Date.now() < end) {
        const v = await fn()
        if (v) return v
        await sleep(stepMs)
    }
    return null
}

// ---- Mock Blockfrost (chỉ cho luồng nạp ADA) ----
const chainState = { tipHeight: 200, txs: new Map() }
const bfServer = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${BF_PORT}`)
    const path = url.pathname
    res.setHeader('content-type', 'application/json')
    if (path === '/blocks/latest') { res.end(JSON.stringify({ height: chainState.tipHeight })); return }
    const addrMatch = path.match(/^\/addresses\/([^/]+)\/transactions$/)
    if (addrMatch) {
        const addr = decodeURIComponent(addrMatch[1])
        const list = []
        for (const [hash, tx] of chainState.txs.entries()) {
            if (tx.inputs.some(i => i.address === addr) || tx.outputs.some(o => o.address === addr)) {
                list.push({ tx_hash: hash, block_height: tx.blockHeight, block_time: tx.blockTime })
            }
        }
        res.end(JSON.stringify(list)); return
    }
    const utxoMatch = path.match(/^\/txs\/([0-9a-fA-F]{64})\/utxos$/)
    if (utxoMatch) {
        const tx = chainState.txs.get(utxoMatch[1].toLowerCase())
        if (!tx) { res.statusCode = 404; res.end(JSON.stringify({ status_code: 404 })); return }
        res.end(JSON.stringify({
            hash: utxoMatch[1].toLowerCase(),
            inputs: tx.inputs.map(i => ({ address: i.address, amount: [{ unit: 'lovelace', quantity: String(i.lovelace) }], collateral: false, reference: false })),
            outputs: tx.outputs.map(o => ({ address: o.address, amount: [{ unit: 'lovelace', quantity: String(o.lovelace) }] }))
        }))
        return
    }
    const metaMatch = path.match(/^\/txs\/([0-9a-fA-F]{64})\/metadata$/)
    if (metaMatch) {
        const tx = chainState.txs.get(metaMatch[1].toLowerCase())
        if (!tx) { res.statusCode = 404; res.end(JSON.stringify({ status_code: 404 })); return }
        res.end(JSON.stringify(tx.metadata || [])); return
    }
    const txMatch = path.match(/^\/txs\/([0-9a-fA-F]{64})$/)
    if (txMatch) {
        const tx = chainState.txs.get(txMatch[1].toLowerCase())
        if (!tx) { res.statusCode = 404; res.end(JSON.stringify({ status_code: 404 })); return }
        res.end(JSON.stringify({ hash: txMatch[1].toLowerCase(), block_height: tx.blockHeight, block_time: tx.blockTime }))
        return
    }
    res.statusCode = 404
    res.end(JSON.stringify({ status_code: 404 }))
})
await new Promise(resolve => bfServer.listen(BF_PORT, '127.0.0.1', resolve))

// ---- Mock hydra-node + seed Fuel UTxO (1000 ADA tại địa chỉ Fuel Key của máy chủ) ----
const fuelSeed = createHmac('sha256', SECRET).update('hydra-pagoda:l2-fuel:v1').digest()
const fuelPk = C.PrivateKey.from_normal_bytes(new Uint8Array(fuelSeed)).to_public()
const fuelAddress = C.EnterpriseAddress.new(0, C.Credential.from_keyhash(fuelPk.hash())).to_address().to_bech32(undefined)
const mock = createHydraMock({ port: HYDRA_PORT })
await mock.start()
mock.seed(fuelAddress, 1_000_000_000)

for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(DB_PATH + ext) } catch { } }
fs.mkdirSync('./.data', { recursive: true })

const serverProc = spawn(process.execPath, ['.output/server/index.mjs'], {
    env: {
        ...process.env,
        PORT: String(PORT),
        HOST: '127.0.0.1',
        NUXT_DB_PATH: DB_PATH,
        NUXT_TREASURY_ADDRESS: TREASURY_TEST_ADDR,
        NUXT_BLOCKFROST_API_KEY: 'preprod_mock_key_hydra',
        NUXT_BLOCKFROST_BASE_URL: `http://127.0.0.1:${BF_PORT}`,
        NUXT_CONFIRMATIONS_REQUIRED: '1',
        HYDRA_L2_ENABLED: 'true',
        HYDRA_NODE_WS_URL: `ws://127.0.0.1:${HYDRA_PORT}`,
        NUXT_HYDRA_SESSION_SECRET: SECRET,
        NUXT_HYDRA_FUEL_TARGET: '3'
    },
    stdio: ['ignore', 'pipe', 'pipe']
})
let serverLog = ''
serverProc.stdout.on('data', d => { serverLog += d })
serverProc.stderr.on('data', d => { serverLog += d })

for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/api/auth/me`); if (r.status === 200) break } catch { }
    await sleep(150)
}

try {
    // ---- Ví test & đăng nhập CIP-8 ----
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
        try { json = await res.json() } catch { }
        return { status: res.status, json, setCookie: res.headers.get('set-cookie') }
    }
    const dbRead = (sql, ...args) => {
        const db = new DatabaseSync(DB_PATH, { readOnly: true })
        try { return db.prepare(sql).all(...args) } finally { db.close() }
    }

    // 1. Hydra status: Head Open
    const stRes = await waitFor(async () => {
        const r = await api('/api/hydra/status')
        return r.json?.headStatus === 'Open' ? r : null
    })
    log(
        '1. GET /api/hydra/status: enabled, kết nối mock hydra-node, Head = Open',
        !!stRes && stRes.json.enabled === true && stRes.json.connected === true && stRes.json.mode === 'hydra_l2',
        `headStatus=${stRes?.json?.headStatus}`
    )

    // 2. Đăng nhập -> Session Key
    const nonceRes = await api('/api/auth/nonce', { method: 'POST', body: { address: userBech32 } })
    const verifyRes = await api('/api/auth/verify', {
        method: 'POST',
        body: { address: userBech32, nonce: nonceRes.json.nonce, ...signCip8(new TextEncoder().encode(nonceRes.json.message)) }
    })
    const cookie = verifyRes.setCookie.split(';')[0]
    const accRow = dbRead('SELECT id, l2_session_vkey, l2_address FROM accounts WHERE address = ?', userBech32)[0]
    log(
        '2. Đăng nhập CIP-8 sinh Session Ephemeral Key (l2_session_vkey, l2_address)',
        verifyRes.status === 200 && !!accRow?.l2_session_vkey && String(accRow?.l2_address || '').startsWith('addr_test'),
        `l2_address=${String(accRow?.l2_address).slice(0, 24)}…`
    )
    const accountId = Number(accRow.id)
    const l2Address = accRow.l2_address

    // 3. Nạp +2000 MC => bút toán L2 #1
    const ordRes = await api('/api/shop/orders', { method: 'POST', cookie, body: { adaAmount: 2 } })
    const order = ordRes.json?.order
    const depositTxHash = 'd'.repeat(63) + '1'
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
    await api(`/api/shop/orders/${order.orderId}/submit`, { method: 'POST', cookie, body: { txHash: depositTxHash } })
    const depRow = await waitFor(() => {
        const r = dbRead("SELECT * FROM mc_ledger WHERE account_id = ? AND reason = 'deposit_ada'", accountId)[0]
        return r && r.hydra_status === 'snapshot_confirmed' ? r : null
    })
    log(
        '3. Nạp 2 ADA (+2000 MC) được ghi lên Hydra Head: hydra_tx_hash + hydra_snapshot_no + snapshot_confirmed',
        !!depRow && /^[0-9a-f]{64}$/.test(depRow.hydra_tx_hash || '') && Number(depRow.hydra_snapshot_no) >= 1 && Number(depRow.delta_mc) === 2000,
        `snapshot=#${depRow?.hydra_snapshot_no}, tx=${String(depRow?.hydra_tx_hash).slice(0, 12)}…`
    )

    // 4. Gieo quẻ -100 MC
    const fortRes = await api('/api/mc/fortune/draw', {
        method: 'POST', cookie,
        body: { category: 'wealth', tier: 'golden', requestId: 'req_hydra_fortune_0001' }
    })
    log(
        '4. Gieo quẻ -50 MC trả proof Hydra L2 (status=snapshot_confirmed, có snapshotNo & txHash)',
        fortRes.status === 200 && fortRes.json?.mcBalance === 1950 && fortRes.json?.spentMc === 50 &&
        fortRes.json?.hydra?.status === 'snapshot_confirmed' && Number(fortRes.json.hydra.snapshotNo) >= 2 &&
        /^[0-9a-f]{64}$/.test(fortRes.json.hydra.txHash || ''),
        `hydra=${JSON.stringify(fortRes.json?.hydra)}`
    )

    // 5. Cúng dường -50 MC
    const meritRes = await api('/api/mc/merit/donate', {
        method: 'POST', cookie,
        body: { amountMc: 50, prayer: 'Hydra L2 test', requestId: 'req_hydra_merit_0001' }
    })
    log(
        '5. Cúng dường -50 MC trả proof Hydra L2 (snapshot_confirmed)',
        meritRes.status === 200 && meritRes.json?.mcBalance === 1900 && meritRes.json?.hydra?.status === 'snapshot_confirmed',
        `hydra=${JSON.stringify(meritRes.json?.hydra)}`
    )

    // 6. Idempotent replay không tạo thêm tx L2
    const txBefore = mock.state.txCount
    const replay = await api('/api/mc/merit/donate', {
        method: 'POST', cookie,
        body: { amountMc: 50, prayer: 'Hydra L2 test', requestId: 'req_hydra_merit_0001' }
    })
    await sleep(400)
    log(
        '6. Replay idempotent không sinh thêm giao dịch L2',
        replay.status === 200 && replay.json?.idempotentReplay === true && mock.state.txCount === txBefore,
        `l2Txs=${mock.state.txCount}`
    )

    // 7. Đối chiếu State UTxO trên Head với số dư SQLite
    const accNow = dbRead('SELECT mc_balance FROM accounts WHERE id = ?', accountId)[0]
    const lastLedger = dbRead('SELECT * FROM mc_ledger WHERE account_id = ? ORDER BY id DESC LIMIT 1', accountId)[0]
    const stateUtxos = mock.utxoAt(l2Address)
    const fields = stateUtxos[0]?.datumFields
    log(
        '7. Đúng 1 State UTxO/tài khoản trên Head, inline datum = [balance_after, ledger_id, delta_mc, account_id] khớp SQLite',
        stateUtxos.length === 1 && Array.isArray(fields) &&
        fields[0] === Number(accNow.mc_balance) && fields[1] === Number(lastLedger.id) &&
        fields[2] === Number(lastLedger.delta_mc) && fields[3] === accountId,
        `datum=${JSON.stringify(fields)}, mc_balance=${accNow.mc_balance}`
    )

    // 8. Thống kê API
    const st2 = await api('/api/hydra/status')
    log(
        '8. /api/hydra/status phản ánh ≥3 tx L2 đã xác nhận và snapshot mới nhất',
        st2.json?.confirmedL2Txs >= 3 && st2.json?.latestSnapshotNo >= 3 && mock.state.invalidCount === 0,
        `confirmed=${st2.json?.confirmedL2Txs}, latest=#${st2.json?.latestSnapshotNo}, invalid=${mock.state.invalidCount}`
    )

    // 9. Mỗi bút toán ledger đều có hydra_tx_hash & trạng thái confirmed
    const ledgerRows = dbRead('SELECT id, hydra_tx_hash, hydra_status FROM mc_ledger WHERE account_id = ?', accountId)
    log(
        '9. Cả 3 bút toán mc_ledger đều có hydra_tx_hash và hydra_status=snapshot_confirmed',
        ledgerRows.length === 3 && ledgerRows.every(r => r.hydra_tx_hash && r.hydra_status === 'snapshot_confirmed'),
        `rows=${ledgerRows.length}`
    )

    // 10. Fallback: hydra-node sập => gameplay vẫn chạy bằng SQLite (offchain)
    await mock.stop()
    await waitFor(async () => (await api('/api/hydra/status')).json?.connected === false, 5000)
    const offBuy = await api('/api/mc/shop/buy', {
        method: 'POST', cookie, body: { itemId: 'thailand', requestId: 'req_hydra_offline_buy_01' }
    })
    const offRow = dbRead('SELECT * FROM mc_ledger WHERE id = ?', offBuy.json?.ledgerId)[0]
    log(
        '10. Fallback: hydra-node ngắt kết nối vẫn mua được vật phẩm, hydra_status=offchain (không vỡ gameplay)',
        offBuy.status === 200 && offBuy.json?.mcBalance === 1100 &&
        (offRow?.hydra_status || 'offchain') === 'offchain' && !offRow?.hydra_tx_hash &&
        (offBuy.json?.hydra?.status ?? 'offchain') === 'offchain',
        `mcBalance=${offBuy.json?.mcBalance}, hydra_status=${offRow?.hydra_status}`
    )

    // 11. Đối soát tổng
    const agg = dbRead('SELECT COALESCE(SUM(delta_mc),0) AS s FROM mc_ledger WHERE account_id = ?', accountId)[0]
    const acc2 = dbRead('SELECT mc_balance FROM accounts WHERE id = ?', accountId)[0]
    log(
        '11. SUM(delta_mc) = accounts.mc_balance = 1,100 MC (SQLite vẫn là nguồn sự thật)',
        Number(agg.s) === 1100 && Number(acc2.mc_balance) === 1100,
        `sum=${agg.s}, balance=${acc2.mc_balance}`
    )
} catch (e) {
    console.error('Lỗi test:', e)
    log('Test chạy không phát sinh ngoại lệ', false, String(e?.message || e))
    console.log('--- server log (tail) ---\n' + serverLog.split('\n').slice(-40).join('\n'))
} finally {
    bfServer.close()
    await mock.stop().catch(() => { })
    serverProc.kill()
    await sleep(300)
    for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(DB_PATH + ext) } catch { } }
}

const failed = results.filter(r => !r.ok)
console.log(`\n📊 Tổng kết Hydra L2: ${results.length - failed.length}/${results.length} test cases PASS`)
if (failed.length > 0) process.exit(1)
