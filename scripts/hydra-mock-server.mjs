// Mock hydra-node WebSocket API (không cần hydra-node thật) phục vụ kiểm thử lớp Hydra L2.
//
// - Tự cài WebSocket server bằng node:http + upgrade (không cần dependency `ws`).
// - Gửi `Greetings` (headStatus = Open) khi client kết nối.
// - `GetUTxO`  -> `GetUTxOResponse` với tập UTxO hiện tại của Head.
// - `NewTx`    -> giải mã CBOR bằng @hydra-sdk/cardano-wasm, kiểm tra input có trong tập UTxO:
//                hợp lệ -> cập nhật UTxO, phát `TxValid` rồi `SnapshotConfirmed` (số snapshot tăng dần);
//                không hợp lệ -> `TxInvalid`.
// - Cổng điều khiển HTTP cùng cổng: GET /state, POST /seed {address, lovelace}.
//
// Dùng như module:  const mock = createHydraMock({ port }); await mock.start(); mock.seed(addr, lovelace); await mock.stop()
// Chạy CLI:         node scripts/hydra-mock-server.mjs --port 4001 --seed addr_test1...:1000000000
import http from 'node:http'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

function encodeFrame(text, opcode = 0x1) {
    const payload = Buffer.from(text)
    const len = payload.length
    let header
    if (len < 126) header = Buffer.from([0x80 | opcode, len])
    else if (len < 65536) {
        header = Buffer.alloc(4)
        header[0] = 0x80 | opcode
        header[1] = 126
        header.writeUInt16BE(len, 2)
    } else {
        header = Buffer.alloc(10)
        header[0] = 0x80 | opcode
        header[1] = 127
        header.writeBigUInt64BE(BigInt(len), 2)
    }
    return Buffer.concat([header, payload])
}

/** Tách các frame client->server (có mask). Trả về { frames, rest }. */
function parseFrames(buf) {
    const frames = []
    let off = 0
    while (buf.length - off >= 2) {
        const b0 = buf[off]
        const b1 = buf[off + 1]
        const opcode = b0 & 0x0f
        const masked = (b1 & 0x80) !== 0
        let len = b1 & 0x7f
        let p = off + 2
        if (len === 126) {
            if (buf.length - p < 2) break
            len = buf.readUInt16BE(p)
            p += 2
        } else if (len === 127) {
            if (buf.length - p < 8) break
            len = Number(buf.readBigUInt64BE(p))
            p += 8
        }
        let mask = null
        if (masked) {
            if (buf.length - p < 4) break
            mask = buf.subarray(p, p + 4)
            p += 4
        }
        if (buf.length - p < len) break
        const payload = Buffer.from(buf.subarray(p, p + len))
        if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]
        frames.push({ opcode, payload })
        off = p + len
    }
    return { frames, rest: buf.subarray(off) }
}

function decodeDatumFields(out) {
    try {
        const pd = out.plutus_data()
        if (!pd) return null
        const constr = pd.as_constr_plutus_data()
        const list = constr.data()
        const fields = []
        for (let i = 0; i < list.len(); i++) fields.push(Number(list.get(i).as_integer().to_str()))
        return fields
    } catch {
        return null
    }
}

export function createHydraMock({ port = 4001, snapshotDelayMs = 30, headStatus = 'Open' } = {}) {
    /** Trạng thái bền qua stop()/start() để test mô phỏng mất kết nối rồi nối lại. */
    const state = {
        utxo: {}, // ref -> { address, value:{lovelace}, datumFields? }
        snapshotNo: 0,
        txCount: 0,
        invalidCount: 0,
        confirmedTxIds: []
    }
    let server = null
    const sockets = new Set() // net sockets (upgrade)
    let counter = 0

    function send(sock, obj) {
        if (sock.destroyed) return
        sock.write(encodeFrame(JSON.stringify(obj)))
    }
    function broadcast(obj) {
        for (const s of sockets) send(s, obj)
    }
    function utxoView() {
        const out = {}
        for (const [ref, u] of Object.entries(state.utxo)) {
            out[ref] = {
                address: u.address,
                datum: null,
                datumhash: null,
                inlineDatum: u.datumFields ? { constructor: 0, fields: u.datumFields.map(n => ({ int: n })) } : null,
                referenceScript: null,
                value: { lovelace: u.value.lovelace }
            }
        }
        return out
    }

    function seed(address, lovelace) {
        const ref = `${crypto.randomBytes(32).toString('hex')}#0`
        state.utxo[ref] = { address, value: { lovelace: Number(lovelace) } }
        return ref
    }

    function handleNewTx(sock, msg) {
        const cborHex = msg?.transaction?.cborHex
        let txId = String(msg?.transaction?.txId || '').toLowerCase()
        try {
            const fixed = C.FixedTransaction.from_hex(cborHex)
            txId = fixed.transaction_hash().to_hex()
            const body = C.Transaction.from_hex(cborHex).body()
            const ins = body.inputs()
            const spent = []
            for (let i = 0; i < ins.len(); i++) {
                const inp = ins.get(i)
                const ref = `${inp.transaction_id().to_hex()}#${inp.index()}`
                if (!state.utxo[ref]) throw new Error(`BadInputsUTxO: ${ref}`)
                spent.push(ref)
            }
            if (new Set(spent).size !== spent.length) throw new Error('BadInputsUTxO: duplicated input')
            const outs = body.outputs()
            const created = {}
            for (let i = 0; i < outs.len(); i++) {
                const o = outs.get(i)
                created[`${txId}#${i}`] = {
                    address: o.address().to_bech32(undefined),
                    value: { lovelace: Number(o.amount().coin().to_str()) },
                    datumFields: decodeDatumFields(o)
                }
            }
            for (const ref of spent) delete state.utxo[ref]
            Object.assign(state.utxo, created)
            state.txCount++
            broadcast({ tag: 'TxValid', headId: 'mockhead', transactionId: txId, transaction: { txId } })
            setTimeout(() => {
                state.snapshotNo++
                state.confirmedTxIds.push(txId)
                broadcast({
                    tag: 'SnapshotConfirmed',
                    headId: 'mockhead',
                    snapshot: { headId: 'mockhead', number: state.snapshotNo, confirmed: [txId], utxo: utxoView() }
                })
            }, snapshotDelayMs)
        } catch (e) {
            state.invalidCount++
            send(sock, {
                tag: 'TxInvalid',
                headId: 'mockhead',
                utxo: utxoView(),
                transaction: { txId },
                validationError: { reason: String(e?.message || e) }
            })
        }
    }

    function onMessage(sock, text) {
        let msg
        try { msg = JSON.parse(text) } catch { return }
        if (msg.tag === 'GetUTxO') {
            send(sock, { tag: 'GetUTxOResponse', headId: 'mockhead', utxo: utxoView() })
        } else if (msg.tag === 'NewTx') {
            handleNewTx(sock, msg)
        } else {
            send(sock, { tag: 'CommandFailed', clientInput: msg })
        }
    }

    function onUpgrade(req, sock) {
        const key = req.headers['sec-websocket-key']
        if (!key) { sock.destroy(); return }
        const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64')
        sock.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
            `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
        )
        sockets.add(sock)
        sock.setNoDelay(true)
        let buf = Buffer.alloc(0)
        sock.on('data', (chunk) => {
            buf = Buffer.concat([buf, chunk])
            const { frames, rest } = parseFrames(buf)
            buf = rest
            for (const f of frames) {
                if (f.opcode === 0x1) onMessage(sock, f.payload.toString('utf8'))
                else if (f.opcode === 0x9) sock.write(Buffer.concat([Buffer.from([0x8a, f.payload.length]), f.payload]))
                else if (f.opcode === 0x8) { sock.end(Buffer.from([0x88, 0x00])); }
            }
        })
        const cleanup = () => sockets.delete(sock)
        sock.on('close', cleanup)
        sock.on('error', cleanup)
        counter++
        send(sock, {
            tag: 'Greetings',
            headStatus,
            hydraHeadId: 'mockhead',
            me: { vkey: 'mock' },
            snapshotUtxo: utxoView(),
            hydraNodeVersion: 'mock-0.0.0'
        })
    }

    function readJson(req) {
        return new Promise((resolve) => {
            let b = ''
            req.on('data', c => (b += c))
            req.on('end', () => { try { resolve(JSON.parse(b || '{}')) } catch { resolve({}) } })
        })
    }

    async function onRequest(req, res) {
        res.setHeader('content-type', 'application/json')
        const url = new URL(req.url, 'http://x')
        if (req.method === 'GET' && url.pathname === '/state') {
            res.end(JSON.stringify({
                snapshotNo: state.snapshotNo,
                txCount: state.txCount,
                invalidCount: state.invalidCount,
                connections: sockets.size,
                utxo: state.utxo
            }))
            return
        }
        if (req.method === 'POST' && url.pathname === '/seed') {
            const b = await readJson(req)
            res.end(JSON.stringify({ ref: seed(b.address, b.lovelace) }))
            return
        }
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'not_found' }))
    }

    return {
        state,
        seed,
        get connections() { return sockets.size },
        get connectionCount() { return counter },
        /** UTxO đang nằm ở một địa chỉ. */
        utxoAt(address) {
            return Object.entries(state.utxo)
                .filter(([, u]) => u.address === address)
                .map(([ref, u]) => ({ ref, lovelace: u.value.lovelace, datumFields: u.datumFields ?? null }))
        },
        start() {
            return new Promise((resolve, reject) => {
                server = http.createServer(onRequest)
                server.on('upgrade', onUpgrade)
                server.once('error', reject)
                server.listen(port, '127.0.0.1', () => resolve())
            })
        },
        /** Đóng server và ngắt toàn bộ kết nối (mô phỏng hydra-node sập). */
        stop() {
            return new Promise((resolve) => {
                for (const s of sockets) s.destroy()
                sockets.clear()
                if (!server) return resolve()
                const srv = server
                server = null
                srv.close(() => resolve())
            })
        }
    }
}

// ---- CLI ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2)
    const getArg = (name, def) => {
        const i = args.indexOf(name)
        return i >= 0 ? args[i + 1] : def
    }
    const port = Number(getArg('--port', 4001))
    const mock = createHydraMock({ port })
    await mock.start()
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--seed') {
            const [addr, lovelace] = String(args[i + 1]).split(':')
            mock.seed(addr, Number(lovelace))
            console.log(`[hydra-mock] seed ${lovelace} lovelace -> ${addr}`)
        }
    }
    console.log(`[hydra-mock] ws://127.0.0.1:${port} (headStatus=Open). Ctrl+C để dừng.`)
}
