// Script tự động upload toàn bộ ảnh Thẻ Bài Di Sản (public/images/cards/*.png) lên IPFS
// và tự động ghi trường `ipfsImage: "ipfs://<CID>"` vào `data/cards/catalog.json` cho chuẩn NFT CIP-68 vĩnh viễn.
//
// Hỗ trợ 2 dịch vụ IPFS phổ biến (tự nhận diện qua .env):
//   1. Pinata JWT (khuyên dùng, miễn phí 1GB): đặt PINATA_JWT=... trong .env
//   2. Blockfrost IPFS: đặt BLOCKFROST_IPFS_PROJECT_ID=... trong .env
//
// Cách chạy:
//   npm run cards:upload-ipfs
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ENV_PATH = path.join(ROOT, '.env')
const CARDS_DIR = path.join(ROOT, 'public', 'images', 'cards')
const CATALOG_PATH = path.join(ROOT, 'data', 'cards', 'catalog.json')

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
const pinataJwt = env.PINATA_JWT || env.NUXT_PINATA_JWT || ''
const bfIpfsKey = env.BLOCKFROST_IPFS_PROJECT_ID || env.NUXT_BLOCKFROST_IPFS_PROJECT_ID || ''

if (!pinataJwt && !bfIpfsKey) {
  console.log('\n⚠️ Chưa cấu hình khóa IPFS trong file .env!')
  console.log('👉 Hãy thêm 1 trong 2 biến sau vào file .env rồi chạy lại `npm run cards:upload-ipfs`:')
  console.log('   - PINATA_JWT=<JWT_tu_pinata.cloud>  (Khuyên dùng - miễn phí 1GB)')
  console.log('   - BLOCKFROST_IPFS_PROJECT_ID=<ipfs_project_id_tu_blockfrost.io>\n')
  process.exit(1)
}

async function uploadToPinata(filePath, fileName) {
  const form = new FormData()
  const bytes = fs.readFileSync(filePath)
  form.append('file', new Blob([bytes], { type: 'image/png' }), fileName)
  form.append('pinataMetadata', JSON.stringify({ name: `hydra-pagoda-${fileName}` }))

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: form
  })
  if (!res.ok) {
    throw new Error(`Pinata HTTP ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.IpfsHash
}

async function uploadToBlockfrostIpfs(filePath, fileName) {
  const form = new FormData()
  const bytes = fs.readFileSync(filePath)
  form.append('file', new Blob([bytes], { type: 'image/png' }), fileName)

  const addRes = await fetch('https://ipfs.blockfrost.io/api/v0/ipfs/add', {
    method: 'POST',
    headers: { project_id: bfIpfsKey },
    body: form
  })
  if (!addRes.ok) {
    throw new Error(`Blockfrost IPFS add HTTP ${addRes.status}: ${await addRes.text()}`)
  }
  const added = await addRes.json()
  const cid = added.ipfs_hash

  const pinRes = await fetch(`https://ipfs.blockfrost.io/api/v0/ipfs/pin/add/${cid}`, {
    method: 'POST',
    headers: { project_id: bfIpfsKey }
  })
  if (!pinRes.ok) {
    console.warn(`⚠️ Pin CID ${cid} cảnh báo (${pinRes.status})`)
  }
  return cid
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))
let uploadedCount = 0

console.log(`🚀 Bắt đầu tải ảnh Thẻ Bài Di Sản lên IPFS (${pinataJwt ? 'Pinata' : 'Blockfrost IPFS'})...`)

for (const card of catalog.cards) {
  const fileName = `${card.id}.png`
  const filePath = path.join(CARDS_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️ Bỏ qua ${card.id} (chưa có file ${fileName})`)
    continue
  }
  if (card.ipfsImage && !process.argv.includes('--force')) {
    console.log(`✔ ${card.id} đã có ${card.ipfsImage} (dùng --force để tải lại)`)
    continue
  }

  try {
    const cid = pinataJwt
      ? await uploadToPinata(filePath, fileName)
      : await uploadToBlockfrostIpfs(filePath, fileName)
    card.ipfsImage = `ipfs://${cid}`
    uploadedCount++
    console.log(`🎉 ${card.id} -> ipfs://${cid}`)
  } catch (err) {
    console.error(`❌ Lỗi upload ${card.id}:`, err.message)
  }
}

if (uploadedCount > 0) {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf8')
  console.log(`\n✅ Đã cập nhật ${uploadedCount} đường dẫn ipfs:// vào data/cards/catalog.json!`)
  console.log('👉 Từ giờ mọi NFT CIP-68 đúc mới sẽ lưu trực tiếp ảnh ipfs:// vĩnh viễn trong Inline Datum!\n')
} else {
  console.log('\nℹ Không có ảnh mới nào cần upload.\n')
}
