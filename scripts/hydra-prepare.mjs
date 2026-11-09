// Chuẩn bị môi trường Hydra L2 OFFLINE cho dev (chạy 1 lần):  npm run hydra:prepare
//
// Việc script làm:
//   1. Đảm bảo `.env` có NUXT_HYDRA_SESSION_SECRET (tự sinh nếu trống) + bật HYDRA_L2_ENABLED + HYDRA_NODE_WS_URL.
//   2. Dẫn xuất địa chỉ Fuel (đúng thuật toán server: HMAC-SHA256(secret, 'hydra-pagoda:l2-fuel:v1')).
//   3. Sinh `.hydra-offline/utxo.json`: UTxO ban đầu của Head = 1000 ADA tại địa chỉ Fuel.
//   4. Tải `protocol-parameters.json` (phí = 0) của hydra-node vào `.hydra-offline/`.
//   5. Sinh khóa Hydra (`hydra.sk/.vk`) bằng chính image hydra-node qua Docker.
//
// Sau đó:  docker compose -f docker-compose.hydra.yml up -d   rồi   pnpm dev
//
// Tùy chọn:  --fuel-ada 1000   --reset (xóa .hydra-offline và sinh lại, giữ nguyên secret trong .env)
import fs from 'node:fs'
import path from 'node:path'
import { createHmac, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'

const ROOT = process.cwd()
const ENV_PATH = path.join(ROOT, '.env')
const DIR = path.join(ROOT, '.hydra-offline')
// 0.22.4: cac ban 1.x/2.x bi SIGILL tren CPU khong co AVX2 (xem docker-compose.hydra.yml)
const HYDRA_IMAGE = 'ghcr.io/cardano-scaling/hydra-node:0.22.4'
const PP_URLS = [
    'https://raw.githubusercontent.com/cardano-scaling/hydra/0.22.4/hydra-cluster/config/protocol-parameters.json',
    'https://raw.githubusercontent.com/cardano-scaling/hydra/master/hydra-cluster/config/protocol-parameters.json'
]

const args = process.argv.slice(2)
const argVal = (name, def) => {
    const i = args.indexOf(name)
    return i >= 0 && args[i + 1] ? args[i + 1] : def
}
const fuelAda = Number(argVal('--fuel-ada', '1000'))
if (!Number.isFinite(fuelAda) || fuelAda < 10) {
    console.error('❌ --fuel-ada phải >= 10')
    process.exit(1)
}

// ---------- 1. .env ----------
function readEnvText() {
    return fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : ''
}
function getEnv(text, key) {
    const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return m ? m[1].trim() : ''
}
function setEnv(text, key, value) {
    const re = new RegExp(`^${key}=.*$`, 'm')
    if (re.test(text)) return text.replace(re, `${key}=${value}`)
    return text + (text.endsWith('\n') || text === '' ? '' : '\n') + `${key}=${value}\n`
}

let envText = readEnvText()
let secret = getEnv(envText, 'NUXT_HYDRA_SESSION_SECRET') || getEnv(envText, 'HYDRA_SESSION_SECRET')
let secretIsNew = false
if (!secret) {
    secret = randomBytes(32).toString('hex')
    secretIsNew = true
    envText = setEnv(envText, 'NUXT_HYDRA_SESSION_SECRET', secret)
}
envText = setEnv(envText, 'HYDRA_L2_ENABLED', 'true')
if (!getEnv(envText, 'HYDRA_NODE_WS_URL')) envText = setEnv(envText, 'HYDRA_NODE_WS_URL', 'ws://127.0.0.1:4001')
fs.writeFileSync(ENV_PATH, envText)
console.log(`✔ .env: HYDRA_L2_ENABLED=true, HYDRA_NODE_WS_URL=${getEnv(envText, 'HYDRA_NODE_WS_URL')}, secret ${secretIsNew ? 'ĐÃ TẠO MỚI' : 'giữ nguyên'}`)

// ---------- 2. Địa chỉ Fuel ----------
const network = (process.env.NUXT_PUBLIC_CARDANO_NETWORK || getEnv(envText, 'NUXT_PUBLIC_CARDANO_NETWORK') || 'preprod').toLowerCase()
const networkId = network === 'mainnet' ? 1 : 0
const fuelSeed = createHmac('sha256', secret).update('hydra-pagoda:l2-fuel:v1').digest()
const fuelPk = C.PrivateKey.from_normal_bytes(new Uint8Array(fuelSeed)).to_public()
const fuelAddress = C.EnterpriseAddress.new(networkId, C.Credential.from_keyhash(fuelPk.hash())).to_address().to_bech32(undefined)
console.log(`✔ Địa chỉ Fuel (${network}): ${fuelAddress}`)

// ---------- 3. Thư mục + utxo.json ----------
if (args.includes('--reset')) fs.rmSync(DIR, { recursive: true, force: true })
fs.mkdirSync(DIR, { recursive: true })

const initialTxId = randomBytes(32).toString('hex')
const utxo = {
    [`${initialTxId}#0`]: {
        address: fuelAddress,
        value: { lovelace: Math.floor(fuelAda * 1_000_000) },
        datum: null,
        datumhash: null,
        inlineDatum: null,
        inlineDatumRaw: null,
        referenceScript: null
    }
}
fs.writeFileSync(path.join(DIR, 'utxo.json'), JSON.stringify(utxo, null, 2))
console.log(`✔ utxo.json: ${fuelAda} ADA tại địa chỉ Fuel`)

// ---------- 4. protocol-parameters.json (phí 0) ----------
const ppPath = path.join(DIR, 'protocol-parameters.json')
if (!fs.existsSync(ppPath)) {
    let ok = false
    for (const url of PP_URLS) {
        try {
            const res = await fetch(url)
            if (!res.ok) continue
            const pp = await res.json()
            pp.txFeeFixed = 0
            pp.txFeePerByte = 0
            if (pp.executionUnitPrices) { pp.executionUnitPrices.priceMemory = 0; pp.executionUnitPrices.priceSteps = 0 }
            fs.writeFileSync(ppPath, JSON.stringify(pp, null, 2))
            ok = true
            break
        } catch { /* thử URL kế */ }
    }
    if (!ok) {
        console.error('❌ Không tải được protocol-parameters.json. Kiểm tra mạng rồi chạy lại.')
        process.exit(1)
    }
}
console.log('✔ protocol-parameters.json (phí = 0)')

// ---------- 5. Khóa Hydra ----------
if (!fs.existsSync(path.join(DIR, 'hydra.sk')) || !fs.existsSync(path.join(DIR, 'hydra.vk'))) {
    const r = spawnSync('docker', ['run', '--rm', '-v', `${DIR}:/data`, HYDRA_IMAGE, 'gen-hydra-key', '--output-file', '/data/hydra'], {
        encoding: 'utf8'
    })
    if (r.status !== 0) {
        console.error('❌ Không sinh được khóa Hydra bằng Docker. Docker Desktop đã chạy chưa?')
        console.error(r.stderr || r.stdout)
        process.exit(1)
    }
}
console.log('✔ Khóa Hydra: .hydra-offline/hydra.sk, hydra.vk')

console.log('\nXong. Bước tiếp theo:')
console.log('  docker compose -f docker-compose.hydra.yml up -d')
console.log('  pnpm dev')
console.log('Kiểm tra: http://127.0.0.1:3012/api/hydra/status  (headStatus = Open)')
if (!secretIsNew) {
    console.log('\nLưu ý: nếu bạn ĐỔI secret trong .env sau lần chuẩn bị trước, hãy chạy lại với --reset rồi `down` + `up` Docker.')
}
