/**
 * Đúc Thẻ Bài Di Sản Cổ Tự thành NFT chuẩn CIP-68 thật trên Cardano L1 (Preprod / Mainnet)
 * bằng `@hydra-sdk/cardano-wasm` + `@hydra-sdk/core`.
 *
 * Chuẩn CIP-68 (Datum Metadata Standard):
 * - Policy: Native Script (`ScriptPubkey` dẫn xuất tất định từ `NUXT_HYDRA_SESSION_SECRET` với nhãn riêng).
 * - Reference Token (Label 100 — tiền tố hex `000643b0`):
 *   Gửi tới địa chỉ lưu trữ siêu dữ liệu (`referenceAddress`, mặc định `treasuryAddress`) kèm
 *   Plutus Inline Datum chuẩn CIP-68: `Constr 0 [Map<bytes, data>, Int(1), List[]]`.
 * - User Token (Label 222 — tiền tố hex `000de140`):
 *   Gửi thẳng tới ví Cardano của người chơi (`ownerAddress`), hiển thị ngay trên Eternl / Lace / Cardanoscan.
 * - Quy trình ký 2 bên (Co-sign):
 *   1. Server dựng unsignedTx bằng UTxO từ ví người chơi (người chơi trả phí gas L1 ~0.2 ADA + min-UTxO).
 *   2. Người chơi ký bằng CIP-30 `signTx(unsignedTxCbor, true)` (partialSign = true).
 *   3. Server xác minh `txHash` khớp tuyệt đối, ghép chữ ký người chơi + tự ký thêm witness Policy Key của server
 *      + đính kèm NativeScript, trả `signedTxCbor` hoàn chỉnh để ví phát tán lên Cardano L1 (`submitTx`).
 */
import { createHmac } from 'node:crypto'
import { DEFAULT_PROTOCOL_PARAMETERS } from '@hydra-sdk/core'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { apiError } from '../wallet/auth.ts'
import { getHydraSecret } from '../hydra/sessionKey.ts'
import type { DecodedUtxo } from '../wallet/txBuilder.ts'
import type { BuddhistCardItem } from './catalog.ts'

export const CIP68_LABEL_100_PREFIX = '000643b0' // Reference NFT (100)
export const CIP68_LABEL_222_PREFIX = '000de140' // User NFT (222)

export interface Cip68Policy {
  sk: C.PrivateKey
  nativeScript: C.NativeScript
  policyId: string
}

export interface BuildCip68MintInput {
  card: BuddhistCardItem
  serialNo: number
  ownerAddress: string
  changeAddress: string
  referenceAddress: string
  imageBaseUrl: string
  utxos: Array<string | DecodedUtxo>
}

export interface BuiltCip68MintTx {
  unsignedTxCbor: string
  txHash: string
  feeLovelace: number
  policyId: string
  assetSlug: string
  refAssetNameHex: string
  userAssetNameHex: string
  refAssetId: string
  userAssetId: string
}

/** Dẫn xuất Policy Key & NativeScript cố định của bộ sưu tập Di Sản Cổ Tự Vạn Cảnh Chùa. */
export async function getCip68Policy(): Promise<Cip68Policy> {
  const secret = await getHydraSecret()
  const seed = createHmac('sha256', secret).update('hydra-pagoda:cip68-heritage-policy:v1').digest()
  const sk = C.PrivateKey.from_normal_bytes(new Uint8Array(seed))
  const pk = sk.to_public()
  const scriptPubkey = C.ScriptPubkey.new(pk.hash())
  const nativeScript = C.NativeScript.new_script_pubkey(scriptPubkey)
  const policyId = nativeScript.hash().to_hex()
  return { sk, nativeScript, policyId }
}

function toWasmAddress(raw: string): C.Address {
  const clean = raw.trim()
  try {
    return clean.startsWith('addr') ? C.Address.from_bech32(clean) : C.Address.from_hex(clean)
  } catch {
    try {
      return C.Address.from_hex(clean)
    } catch {
      apiError(400, 'bad_address', 'Địa chỉ ví Cardano không hợp lệ')
    }
  }
}

function toWasmUtxo(raw: unknown): C.TransactionUnspentOutput {
  if (typeof raw === 'string') {
    const hex = raw.trim()
    if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
      apiError(400, 'malformed_utxo', 'UTxO từ ví không đúng định dạng hex CBOR')
    }
    try {
      return C.TransactionUnspentOutput.from_hex(hex)
    } catch {
      apiError(400, 'malformed_utxo', 'Không thể giải mã UTxO từ ví')
    }
  }

  if (!raw || typeof raw !== 'object') {
    apiError(400, 'malformed_utxo', 'UTxO từ ví không đúng định dạng hợp lệ')
  }

  const candidate = raw as Partial<DecodedUtxo>
  const txHash = typeof candidate.input?.txHash === 'string' ? candidate.input.txHash.trim() : ''
  const outputIndex = Number(candidate.input?.outputIndex)
  const rawAddress = typeof candidate.output?.address === 'string' ? candidate.output.address.trim() : ''
  const amounts = Array.isArray(candidate.output?.amount) ? candidate.output.amount : null

  if (!/^[0-9a-fA-F]{64}$/.test(txHash) || !Number.isSafeInteger(outputIndex) || outputIndex < 0 || !rawAddress || !amounts) {
    apiError(400, 'malformed_utxo', 'UTxO từ ví thiếu trường input/output hợp lệ')
  }

  let lovelace = 0n
  const policyGroups = new Map<string, Array<{ assetNameHex: string; quantity: bigint }>>()
  for (const asset of amounts) {
    const unit = typeof asset?.unit === 'string' ? asset.unit.trim() : ''
    const qtyRaw = String(asset?.quantity ?? '').trim()
    if (!unit || !/^\d+$/.test(qtyRaw)) apiError(400, 'malformed_utxo', 'Số lượng tài sản trong UTxO không hợp lệ')
    const qty = BigInt(qtyRaw)
    if (qty <= 0n) continue
    if (unit === 'lovelace') {
      lovelace += qty
      continue
    }
    const cleanUnit = unit.replace('.', '')
    if (cleanUnit.length < 56 || cleanUnit.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleanUnit)) {
      apiError(400, 'malformed_utxo', 'Mã native token trong UTxO không hợp lệ')
    }
    const pid = cleanUnit.slice(0, 56).toLowerCase()
    const anHex = cleanUnit.slice(56).toLowerCase()
    const list = policyGroups.get(pid) ?? []
    list.push({ assetNameHex: anHex, quantity: qty })
    policyGroups.set(pid, list)
  }

  const txInput = C.TransactionInput.new(C.TransactionHash.from_hex(txHash), outputIndex)
  const addr = toWasmAddress(rawAddress)
  const val = C.Value.new(C.BigNum.from_str(lovelace.toString()))
  if (policyGroups.size > 0) {
    const ma = C.MultiAsset.new()
    for (const [pid, entries] of policyGroups) {
      const assets = C.Assets.new()
      for (const item of entries) {
        assets.insert(C.AssetName.new(Buffer.from(item.assetNameHex, 'hex')), C.BigNum.from_str(item.quantity.toString()))
      }
      ma.insert(C.ScriptHash.from_hex(pid), assets)
    }
    val.set_multiasset(ma)
  }
  return C.TransactionUnspentOutput.new(txInput, C.TransactionOutput.new(addr, val))
}

function bytesData(text: string): C.PlutusData {
  return C.PlutusData.new_bytes(new Uint8Array(Buffer.from(text, 'utf8')))
}

/** Cắt chuỗi dài thành danh sách các đoạn <= 64 byte cho chuẩn CIP-68 PlutusData. */
function stringOrChunkedData(text: string): C.PlutusData {
  const buf = Buffer.from(text, 'utf8')
  if (buf.length <= 64) {
    return C.PlutusData.new_bytes(new Uint8Array(buf))
  }
  const list = C.PlutusList.new()
  // Cắt an toàn theo ký tự UTF-8 sao cho mỗi đoạn <= 60 bytes
  let current = ''
  for (const ch of text) {
    if (Buffer.byteLength(current + ch, 'utf8') > 60) {
      list.add(bytesData(current))
      current = ch
    } else {
      current += ch
    }
  }
  if (current) list.add(bytesData(current))
  return C.PlutusData.new_list(list)
}

/**
 * Tạo Plutus Inline Datum chuẩn CIP-68:
 *   Constr 0 [ Map<bytes, PlutusData> metadata, Int 1 (version), List [] (extra) ]
 * Lưu ý: Ví Eternl giải mã đẹp nhất khi `name` và `description` là 1 chuỗi bytes <= 64 byte (UTF-8),
 * tránh bị hiển thị dạng hex khi cắt thành PlutusList.
 */
function truncateUtf8Bytes(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text
  let out = ''
  for (const ch of text) {
    if (Buffer.byteLength(out + ch + '...', 'utf8') > maxBytes) break
    out += ch
  }
  return out.trim() + '...'
}

function buildCip68Datum(card: BuddhistCardItem, serialNo: number, imageUrl: string): C.PlutusData {
  const metaMap = C.PlutusMap.new()
  const safeName = truncateUtf8Bytes(`${card.title} #${serialNo}`, 62)
  const safeDesc = truncateUtf8Bytes(card.subtitle || card.meaning, 62)
  const entries: Array<[string, C.PlutusData]> = [
    ['name', bytesData(safeName)],
    ['image', stringOrChunkedData(imageUrl)],
    ['mediaType', bytesData('image/png')],
    ['description', bytesData(safeDesc)],
    ['collection', bytesData('Van Canh Thien Tu - Di San Co Tu')],
    ['cardId', bytesData(card.id)],
    ['rarity', bytesData(card.rarity)],
    ['country', bytesData(card.countryCode)],
    ['category', bytesData(card.category)]
  ]

  for (const [k, v] of entries) {
    const mv = C.PlutusMapValues.new()
    mv.add(v)
    metaMap.insert(bytesData(k), mv)
  }

  const fields = C.PlutusList.new()
  fields.add(C.PlutusData.new_map(metaMap))
  fields.add(C.PlutusData.new_integer(C.BigInt.from_str('1')))
  fields.add(C.PlutusData.new_list(C.PlutusList.new()))

  return C.PlutusData.new_constr_plutus_data(
    C.ConstrPlutusData.new(C.BigNum.from_str('0'), fields)
  )
}

/** Tạo tên tài sản duy nhất (<= 28 byte sau khi gắn prefix 4 byte -> tổng <= 32 byte). */
function buildAssetSlug(cardId: string, serialNo: number): string {
  const shortCard = cardId.replace(/^card_/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18)
  return `${shortCard}_${serialNo}`.slice(0, 28)
}

function makeSingleAssetValue(lovelace: number, policyScriptHash: C.ScriptHash, assetNameBytes: Uint8Array): C.Value {
  const val = C.Value.new(C.BigNum.from_str(String(lovelace)))
  const ma = C.MultiAsset.new()
  const assets = C.Assets.new()
  assets.insert(C.AssetName.new(assetNameBytes), C.BigNum.from_str('1'))
  ma.insert(policyScriptHash, assets)
  val.set_multiasset(ma)
  return val
}

/**
 * Dựng giao dịch Mint CIP-68 L1 chưa ký.
 * - Output 0: Reference Token (100) + Inline Datum CIP-68 gửi về `referenceAddress` (2.5 ADA min-UTxO)
 * - Output 1: User Token (222) gửi thẳng về `ownerAddress` của người chơi (2.0 ADA min-UTxO)
 */
export async function buildCip68MintUnsignedTx(input: BuildCip68MintInput): Promise<BuiltCip68MintTx> {
  if (!Array.isArray(input.utxos) || input.utxos.length === 0) {
    apiError(400, 'empty_utxos', 'Ví của bạn chưa có UTxO (tADA/ADA) nào để trả phí đúc NFT CIP-68.')
  }

  const policy = await getCip68Policy()
  const policyHash = policy.nativeScript.hash()

  const slug = buildAssetSlug(input.card.id, input.serialNo)
  const slugHex = Buffer.from(slug, 'utf8').toString('hex')
  const refAssetNameHex = `${CIP68_LABEL_100_PREFIX}${slugHex}`
  const userAssetNameHex = `${CIP68_LABEL_222_PREFIX}${slugHex}`
  const refAssetBytes = new Uint8Array(Buffer.from(refAssetNameHex, 'hex'))
  const userAssetBytes = new Uint8Array(Buffer.from(userAssetNameHex, 'hex'))

  const P = DEFAULT_PROTOCOL_PARAMETERS
  const cfg = C.TransactionBuilderConfigBuilder.new()
    .fee_algo(C.LinearFee.new(C.BigNum.from_str(String(P.minFeeA)), C.BigNum.from_str(String(P.minFeeB))))
    .pool_deposit(C.BigNum.from_str(String(P.poolDeposit)))
    .key_deposit(C.BigNum.from_str(String(P.keyDeposit)))
    .max_value_size(Number(P.maxValSize))
    .max_tx_size(Number(P.maxTxSize))
    .coins_per_utxo_byte(C.BigNum.from_str(String(P.coinsPerUtxoSize)))
    .build()

  const tb = C.TransactionBuilder.new(cfg)

  // 1. Mint Builder: đúc đồng thời +1 Reference Token (100) và +1 User Token (222)
  const mintBuilder = C.MintBuilder.new()
  const scriptSource = C.NativeScriptSource.new(policy.nativeScript)
  const mintWitness = C.MintWitness.new_native_script(scriptSource)
  mintBuilder.add_asset(mintWitness, C.AssetName.new(refAssetBytes), C.Int.new_i32(1))
  mintBuilder.add_asset(mintWitness, C.AssetName.new(userAssetBytes), C.Int.new_i32(1))
  tb.set_mint_builder(mintBuilder)

  // 2. Output 0: Reference Token (100) + Plutus Inline Datum CIP-68
  // Ưu tiên dùng URI vĩnh viễn ipfs:// từ catalog (nếu đã pin IPFS), fallback về URL ảnh web của dự án.
  const baseUrl = input.imageBaseUrl.replace(/\/$/, '')
  const imageUrl = input.card.ipfsImage && input.card.ipfsImage.trim()
    ? input.card.ipfsImage.trim()
    : `${baseUrl}/images/cards/${input.card.id}.png`
  const cip68Datum = buildCip68Datum(input.card, input.serialNo, imageUrl)
  const refAddr = toWasmAddress(input.referenceAddress)
  const dataCost = C.DataCost.new_coins_per_byte(C.BigNum.from_str(String(P.coinsPerUtxoSize)))

  const probeRefOut = C.TransactionOutput.new(refAddr, makeSingleAssetValue(3_000_000, policyHash, refAssetBytes))
  probeRefOut.set_plutus_data(cip68Datum)
  const exactMinRef = Number(C.min_ada_for_output(probeRefOut, dataCost).to_str())
  const refLovelace = Math.max(2_000_000, exactMinRef + 100_000)
  const refOut = C.TransactionOutput.new(refAddr, makeSingleAssetValue(refLovelace, policyHash, refAssetBytes))
  refOut.set_plutus_data(cip68Datum)
  tb.add_output(refOut)

  // 3. Output 1: User Token (222) gửi về ví của người chơi (tự tính min-UTxO an toàn)
  const ownerAddr = toWasmAddress(input.ownerAddress)
  const probeUserOut = C.TransactionOutput.new(ownerAddr, makeSingleAssetValue(2_000_000, policyHash, userAssetBytes))
  const exactMinUser = Number(C.min_ada_for_output(probeUserOut, dataCost).to_str())
  const userLovelace = Math.max(1_500_000, exactMinUser + 100_000)
  const userOut = C.TransactionOutput.new(ownerAddr, makeSingleAssetValue(userLovelace, policyHash, userAssetBytes))
  tb.add_output(userOut)

  // 4. Metadata CIP-20 (nhãn 674) mô tả dễ đọc trên ví
  const aux = C.AuxiliaryData.new()
  const gtm = C.GeneralTransactionMetadata.new()
  gtm.insert(
    C.BigNum.from_str('674'),
    C.encode_json_str_to_metadatum(
      JSON.stringify({
        msg: [
          'Van Canh Thien Tu - CIP-68 Heritage NFT',
          `Card: ${slug}`,
          `Rarity: ${input.card.rarity}`
        ]
      }),
      C.MetadataJsonSchema.NoConversions
    )
  )
  aux.set_metadata(gtm)
  tb.set_auxiliary_data(aux)

  // 5. Thêm required signer cho Policy Key để TransactionBuilder tính đủ phí cho 2 chữ ký (user + server policy)
  tb.add_required_signer(policy.sk.to_public().hash())

  // 6. Nạp UTxO ví người chơi & tính phí + trả tiền thừa
  const unspent = C.TransactionUnspentOutputs.new()
  let availableLovelace = 0n
  for (const rawUtxo of input.utxos) {
    const u = toWasmUtxo(rawUtxo)
    unspent.add(u)
    availableLovelace += BigInt(u.output().amount().coin().to_str())
  }

  const changeAddr = toWasmAddress(input.changeAddress || input.ownerAddress)
  try {
    tb.add_inputs_from(unspent, C.CoinSelectionStrategyCIP2.LargestFirstMultiAsset)
    tb.add_change_if_needed(changeAddr)
  } catch {
    const haveAda = (Number(availableLovelace) / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
    apiError(
      400,
      'insufficient_utxo_balance',
      `Số dư ví (${haveAda} ADA) chưa đủ để đúc NFT CIP-68 (cần khoảng 5 ADA cho min-UTxO Reference/User Token và phí mạng ~0.25 ADA).`
    )
  }

  const tx = tb.build_tx()
  const unsignedTxCbor = tx.to_hex()
  const feeLovelace = Number(tx.body().fee().to_str())
  const txHash = C.FixedTransaction.from_hex(unsignedTxCbor).transaction_hash().to_hex()

  return {
    unsignedTxCbor,
    txHash,
    feeLovelace,
    policyId: policy.policyId,
    assetSlug: slug,
    refAssetNameHex,
    userAssetNameHex,
    refAssetId: `${policy.policyId}${refAssetNameHex}`,
    userAssetId: `${policy.policyId}${userAssetNameHex}`
  }
}

/**
 * Ghép chữ ký người chơi (`wallet.signTx(unsignedTxCbor, true)`) + tự ký Policy Key của server
 * + gắn NativeScript vào WitnessSet để tạo `signedTxCbor` hoàn chỉnh gửi lên Cardano L1.
 */
export async function cosignCip68MintTx(
  unsignedTxCbor: string,
  walletWitnessOrTxHex: string
): Promise<{ signedTxCbor: string; txHash: string }> {
  if (typeof walletWitnessOrTxHex !== 'string' || !/^[0-9a-fA-F]+$/.test(walletWitnessOrTxHex)) {
    apiError(400, 'bad_witness', 'Dữ liệu chữ ký giao dịch từ ví không hợp lệ')
  }

  const policy = await getCip68Policy()
  const expectedHash = C.FixedTransaction.from_hex(unsignedTxCbor).transaction_hash().to_hex()

  // Trích xuất Vkeywitnesses của người chơi từ WitnessSet hoặc Full Transaction
  let userVkeys: C.Vkeywitnesses | null = null
  try {
    const ws = C.TransactionWitnessSet.from_hex(walletWitnessOrTxHex)
    if (ws.vkeys() && ws.vkeys()!.len() > 0) userVkeys = ws.vkeys()!
  } catch {
    // thử đọc như full transaction
  }
  if (!userVkeys) {
    try {
      const full = C.Transaction.from_hex(walletWitnessOrTxHex)
      const actualHash = C.FixedTransaction.from_hex(walletWitnessOrTxHex).transaction_hash().to_hex()
      if (actualHash !== expectedHash) {
        apiError(400, 'tx_hash_mismatch', 'Giao dịch đã ký không khớp với giao dịch đúc NFT')
      }
      if (full.witness_set().vkeys() && full.witness_set().vkeys()!.len() > 0) {
        userVkeys = full.witness_set().vkeys()!
      }
    } catch (e: any) {
      if (e?.statusCode) throw e
    }
  }

  if (!userVkeys || userVkeys.len() === 0) {
    apiError(400, 'missing_vkey_witness', 'Không tìm thấy chữ ký ví người chơi trong giao dịch')
  }

  // Tạo bản FixedTransaction chuẩn, thêm chữ ký Policy Key của server trước, sau đó gộp với chữ ký ví người chơi
  const fixed = C.FixedTransaction.from_hex(unsignedTxCbor)
  fixed.sign_and_add_vkey_signature(policy.sk)
  const serverSignedTx = C.Transaction.from_hex(fixed.to_hex())
  const mergedWits = serverSignedTx.witness_set()

  const mergedVkeys = C.Vkeywitnesses.new()
  const existingServerVkeys = mergedWits.vkeys()
  if (existingServerVkeys) {
    for (let i = 0; i < existingServerVkeys.len(); i++) {
      mergedVkeys.add(existingServerVkeys.get(i))
    }
  }
  for (let i = 0; i < userVkeys.len(); i++) {
    mergedVkeys.add(userVkeys.get(i))
  }
  mergedWits.set_vkeys(mergedVkeys)

  // Đảm bảo NativeScript policy luôn có mặt trong WitnessSet
  const scripts = mergedWits.native_scripts() ?? C.NativeScripts.new()
  let hasPolicy = false
  for (let i = 0; i < scripts.len(); i++) {
    if (scripts.get(i).hash().to_hex() === policy.policyId) {
      hasPolicy = true
      break
    }
  }
  if (!hasPolicy) {
    scripts.add(policy.nativeScript)
    mergedWits.set_native_scripts(scripts)
  }

  const finalTx = C.Transaction.new(serverSignedTx.body(), mergedWits, serverSignedTx.auxiliary_data())
  const signedTxCbor = finalTx.to_hex()
  const actualHash = C.FixedTransaction.from_hex(signedTxCbor).transaction_hash().to_hex()
  if (actualHash !== expectedHash) {
    apiError(400, 'tx_hash_mismatch', 'Hash giao dịch sau khi đồng ký không khớp')
  }

  return { signedTxCbor, txHash: actualHash }
}
