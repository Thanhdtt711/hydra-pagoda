/**
 * Mint 1.000.000.000 MC (Native Asset, decimals = 0) một lần duy nhất và KHÓA POLICY bằng TimelockExpiry.
 * - Chia thẳng thành 2 output: Quỹ Bán 850.000.000 MC (85%) + Quỹ Nhiệm Vụ 150.000.000 MC (15%).
 * - Chống chạy lại: kiểm tra Blockfrost `assets/{policyId}4d43` trước khi mint; nếu đã tồn tại thì dừng ngay.
 * - Mặc định chạy chế độ `--dry-run` để xem trước Policy ID, Asset Unit, Expiry Slot.
 *   Muốn gửi giao dịch thật lên Preprod/Mainnet: đặt `MC_MINT_EXECUTE=true` và truyền khóa `MC_POLICY_SKEY_HEX`.
 *
 * Chạy thử (dry-run):
 *   node --experimental-strip-types scripts/mc/mint-mc.mjs
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { MC_ASSET_NAME_HEX, MC_QUEST_POOL, MC_SALE_POOL, MC_TOTAL_SUPPLY } from '../../lib/mc/tokenomics.ts'

// Nạp .env nếu tồn tại
function loadDotEnv() {
  const p = resolve(process.cwd(), '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
    }
  }
}
loadDotEnv()

const network = (process.env.NUXT_PUBLIC_CARDANO_NETWORK || 'preprod').toLowerCase() === 'mainnet' ? 'mainnet' : 'preprod'
const bfKey = process.env.NUXT_BLOCKFROST_API_KEY || process.env.BLOCKFROST_API_KEY || ''
const bfBase =
  process.env.NUXT_BLOCKFROST_BASE_URL ||
  (network === 'mainnet' ? 'https://cardano-mainnet.blockfrost.io/api/v0' : 'https://cardano-preprod.blockfrost.io/api/v0')

const executeMode = process.env.MC_MINT_EXECUTE === 'true'
const ttlSlots = Math.max(300, Number(process.env.MC_POLICY_TTL_SLOTS || 3600))
const saleVault = (process.env.NUXT_MC_SALE_VAULT_ADDRESS || process.env.NUXT_TREASURY_ADDRESS || '').trim()
const questVault = (process.env.NUXT_MC_QUEST_VAULT_ADDRESS || process.env.NUXT_TREASURY_ADDRESS || '').trim()

async function bfGet(path) {
  const res = await fetch(`${bfBase}${path}`, { headers: { project_id: bfKey } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Blockfrost ${path} -> HTTP ${res.status}`)
  return res.json()
}

// 1. Tạo hoặc nạp khóa ký policy (Ed25519 32 byte)
const rawKeyHex = (process.env.MC_POLICY_SKEY_HEX || '').trim()
const privKey = rawKeyHex
  ? C.PrivateKey.from_normal_bytes(Buffer.from(rawKeyHex, 'hex'))
  : C.PrivateKey.from_normal_bytes(randomBytes(32))
const pubKeyHash = privKey.to_public().hash()

// 2. Lấy slot hiện tại từ Blockfrost (hoặc giả lập khi dry-run offline)
let currentSlot = 0
if (bfKey) {
  try {
    const tip = await bfGet('/blocks/latest')
    currentSlot = Number(tip?.slot || 0)
  } catch (e) {
    console.warn(`[mint-mc] Không đọc được slot từ Blockfrost (${e.message}), dùng slot giả lập cho dry-run.`)
  }
}
const expirySlot = Number(process.env.MC_POLICY_EXPIRY_SLOT || (currentSlot > 0 ? currentSlot + ttlSlots : 100_000_000))

// 3. Dựng NativeScript: all [ sig(policyKeyHash), before(expirySlot) ] => khóa cứng vĩnh viễn sau expirySlot!
const scripts = C.NativeScripts.new()
scripts.add(C.NativeScript.new_script_pubkey(C.ScriptPubkey.new(pubKeyHash)))
scripts.add(C.NativeScript.new_timelock_expiry(C.TimelockExpiry.new_timelockexpiry(C.BigNum.from_str(String(expirySlot)))))
const policyScript = C.NativeScript.new_script_all(C.ScriptAll.new(scripts))
const policyId = Buffer.from(policyScript.hash().to_bytes()).toString('hex')
const assetUnit = `${policyId}${MC_ASSET_NAME_HEX}`

console.log('=== THÔNG SỐ MINT NATIVE ASSET MC (1.000.000.000 MC) ===')
console.log(`Mạng             : ${network}`)
console.log(`Policy ID        : ${policyId}`)
console.log(`Asset Unit       : ${assetUnit} (name="MC", decimals=0)`)
console.log(`Tổng cung        : ${MC_TOTAL_SUPPLY.toLocaleString()} MC`)
console.log(`  - Quỹ bán (85%): ${MC_SALE_POOL.toLocaleString()} MC -> ${saleVault || '(chưa đặt NUXT_MC_SALE_VAULT_ADDRESS)'}`)
console.log(`  - Quỹ NV  (15%): ${MC_QUEST_POOL.toLocaleString()} MC -> ${questVault || '(chưa đặt NUXT_MC_QUEST_VAULT_ADDRESS)'}`)
console.log(`Slot hiện tại    : ${currentSlot || '(offline)'}`)
console.log(`Slot khóa policy : ${expirySlot} (sau slot này KHÔNG AI có thể mint thêm)`)
console.log(`Chế độ           : ${executeMode ? 'EXECUTE (gửi giao dịch thật)' : 'DRY-RUN (chỉ kiểm tra, không gửi tx)'}`)

if (bfKey) {
  const existing = await bfGet(`/assets/${assetUnit}`).catch(() => null)
  if (existing && BigInt(existing.quantity || '0') > 0n) {
    console.error(`[mint-mc] DỪNG LẠI: Asset ${assetUnit} đã tồn tại trên chain với tổng cung ${existing.quantity}. Không được mint lần 2!`)
    process.exit(1)
  }
}

if (!executeMode) {
  console.log('\n[DRY-RUN HOÀN TẤT] Để mint thật trên Preprod:')
  console.log('  1. Đặt NUXT_MC_SALE_VAULT_ADDRESS, NUXT_MC_QUEST_VAULT_ADDRESS và MC_POLICY_SKEY_HEX (ví có >= 5 tADA).')
  console.log('  2. Chạy: MC_MINT_EXECUTE=true node --experimental-strip-types scripts/mc/mint-mc.mjs')
  console.log('  3. Lưu NUXT_MC_POLICY_ID và NUXT_MC_POLICY_EXPIRY_SLOT vào .env rồi chạy scripts/mc/verify-supply.mjs.')
  process.exit(0)
}

if (!bfKey || !saleVault || !questVault || !rawKeyHex) {
  console.error('[mint-mc] Thiếu biến môi trường bắt buộc cho chế độ EXECUTE (NUXT_BLOCKFROST_API_KEY, NUXT_MC_SALE_VAULT_ADDRESS, NUXT_MC_QUEST_VAULT_ADDRESS, MC_POLICY_SKEY_HEX).')
  process.exit(1)
}

// 4. Dựng giao dịch mint thật trên L1 (chỉ chạy khi MC_MINT_EXECUTE=true)
const netId = network === 'mainnet' ? 1 : 0
const minterAddr = C.EnterpriseAddress.new(netId, C.Credential.from_keyhash(pubKeyHash)).to_address()
const minterBech32 = minterAddr.to_bech32()
const utxos = await bfGet(`/addresses/${minterBech32}/utxos`)
if (!Array.isArray(utxos) || utxos.length === 0) {
  console.error(`[mint-mc] Ví mint ${minterBech32} chưa có UTxO tADA để trả phí & min-ADA. Hãy nạp >= 5 tADA từ Faucet trước.`)
  process.exit(1)
}

const p = await bfGet('/epochs/latest/parameters')
const cfgBuilder = C.TransactionBuilderConfigBuilder.new()
  .fee_algo(C.LinearFee.new(C.BigNum.from_str(String(p.min_fee_a)), C.BigNum.from_str(String(p.min_fee_b))))
  .pool_deposit(C.BigNum.from_str(String(p.pool_deposit)))
  .key_deposit(C.BigNum.from_str(String(p.key_deposit)))
  .coins_per_utxo_byte(C.BigNum.from_str(String(p.coins_per_utxo_size || '4310')))
  .max_value_size(Number(p.max_val_size || 5000))
  .max_tx_size(Number(p.max_tx_size || 16384))
  .build()

const assetName = C.AssetName.new(Buffer.from(MC_ASSET_NAME_HEX, 'hex'))

// Chia thẳng 2 output: 850M MC (Sale Vault) + 150M MC (Quest Vault)
const makeVaultValue = (mcQty) => {
  const ma = C.MultiAsset.new()
  const assets = C.Assets.new()
  assets.insert(assetName, C.BigNum.from_str(mcQty.toString()))
  ma.insert(policyScript.hash(), assets)
  return C.Value.new_with_assets(C.BigNum.from_str('2000000'), ma)
}

const txBuilder2 = C.TransactionBuilder.new(cfgBuilder)
txBuilder2.set_ttl_bignum(C.BigNum.from_str(String(expirySlot)))
txBuilder2.add_mint_asset(policyScript, assetName, C.Int.new(C.BigNum.from_str(MC_TOTAL_SUPPLY.toString())))
txBuilder2.add_output(C.TransactionOutput.new(C.Address.from_bech32(saleVault), makeVaultValue(MC_SALE_POOL)))
txBuilder2.add_output(C.TransactionOutput.new(C.Address.from_bech32(questVault), makeVaultValue(MC_QUEST_POOL)))

const unspent = C.TransactionUnspentOutputs.new()
for (const u of utxos) {
  const lovelace = u.amount.find((a) => a.unit === 'lovelace')?.quantity || '0'
  unspent.add(
    C.TransactionUnspentOutput.new(
      C.TransactionInput.new(C.TransactionHash.from_bytes(Buffer.from(u.tx_hash, 'hex')), Number(u.output_index)),
      C.TransactionOutput.new(minterAddr, C.Value.new(C.BigNum.from_str(lovelace)))
    )
  )
}
txBuilder2.add_inputs_from(unspent, C.CoinSelectionStrategyCIP2.LargestFirstMultiAsset)
txBuilder2.add_change_if_needed(minterAddr)

const txBody = txBuilder2.build()
const txHash = C.FixedTransaction.new_from_body_bytes(txBody.to_bytes()).transaction_hash()
const vkeys = C.Vkeywitnesses.new()
vkeys.add(C.make_vkey_witness(txHash, privKey))
const nativeScripts = C.NativeScripts.new()
nativeScripts.add(policyScript)
const witnessSet = C.TransactionWitnessSet.new()
witnessSet.set_vkeys(vkeys)
witnessSet.set_native_scripts(nativeScripts)

const signedTx = C.Transaction.new(txBody, witnessSet)
const submitRes = await fetch(`${bfBase}/tx/submit`, {
  method: 'POST',
  headers: { project_id: bfKey, 'Content-Type': 'application/cbor' },
  body: Buffer.from(signedTx.to_bytes())
})
if (!submitRes.ok) {
  console.error('[mint-mc] Gửi tx thất bại:', await submitRes.text())
  process.exit(1)
}
const submittedHash = await submitRes.json()
console.log(`\n[MINT THÀNH CÔNG] txHash: ${submittedHash}`)
console.log(`Thêm vào .env:\nNUXT_MC_POLICY_ID=${policyId}\nNUXT_MC_POLICY_EXPIRY_SLOT=${expirySlot}`)
