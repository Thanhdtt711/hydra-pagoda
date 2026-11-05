/**
 * Dựng giao dịch nạp ADA mua MC coin & ghép witness chữ ký ví bằng `@hydra-sdk/cardano-wasm` và `@hydra-sdk/core`.
 *
 * NGUỒN GỐC TÁI DÙNG:
 * - D:\Vtechcom\hydra-graveyard\apps\graveyard-engine\src\commands\deposit-builder.service.ts
 * - D:\Vtechcom\hydra-graveyard\apps\web-client\app\lib\engine\deposit.ts
 *
 * Điều chỉnh cho Vạn Cảnh Thiền Tự (hydra-pagoda):
 * - Server kiểm soát hoàn toàn địa chỉ nhận (`treasuryAddress`), số lovelace (`expectedLovelace`)
 *   và đính kèm `orderId` vào metadata giao dịch (nhãn 8181 + CIP-20 nhãn 674).
 * - Client chỉ gửi danh sách UTxO hex CBOR từ `wallet.getUtxos()` và `changeAddress`; sau đó ký
 *   qua `wallet.signTx(unsignedTxCbor, true)` và ghép witness bằng `attachOrderWitness`.
 */
import { DEFAULT_PROTOCOL_PARAMETERS } from '@hydra-sdk/core'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { apiError } from './auth'

export interface BuildOrderTxInput {
  orderId: string
  ownerAddress: string
  treasuryAddress: string
  changeAddress: string
  utxosHex: string[]
  lovelace: number
  metadataLabel: number
}

export interface BuiltOrderTx {
  unsignedTxCbor: string
  txHash: string
  feeLovelace: number
}

/** Chấp nhận địa chỉ dạng bech32 (`addr_test1...` / `addr1...`) hoặc hex CBOR từ CIP-30. */
function toWasmAddress(raw: string): C.Address {
  const clean = raw.trim()
  try {
    return clean.startsWith('addr') ? C.Address.from_bech32(clean) : C.Address.from_hex(clean)
  } catch {
    try {
      return C.Address.from_hex(clean)
    } catch {
      apiError(400, 'bad_address', 'Địa chỉ ví hoặc địa chỉ treasury không hợp lệ')
    }
  }
}

/**
 * Dựng giao dịch Cardano L1 chưa ký (unsigned transaction CBOR hex) bằng `@hydra-sdk/cardano-wasm`.
 * Đảm bảo đầu ra trả đúng `lovelace` vào `treasuryAddress` và gắn `orderId` vào metadata.
 */
export function buildOrderUnsignedTx(input: BuildOrderTxInput): BuiltOrderTx {
  if (!input.treasuryAddress) {
    apiError(500, 'treasury_unconfigured', 'Chưa cấu hình địa chỉ ví nhận (TREASURY_ADDRESS)')
  }
  if (!Array.isArray(input.utxosHex) || input.utxosHex.length === 0) {
    apiError(400, 'empty_utxos', 'Ví của bạn chưa có UTxO (tADA/ADA) nào để thực hiện giao dịch')
  }
  if (!Number.isSafeInteger(input.lovelace) || input.lovelace < 2_000_000) {
    apiError(400, 'invalid_amount', 'Số tiền tối thiểu là 2 ADA (2.000.000 lovelace)')
  }

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

  // 1. Đầu ra thanh toán tới địa chỉ treasury do SERVER kiểm soát
  const treasuryAddr = toWasmAddress(input.treasuryAddress)
  const outValue = C.Value.new(C.BigNum.from_str(String(input.lovelace)))
  tb.add_output(C.TransactionOutput.new(treasuryAddr, outValue))

  // 2. Metadata: nhãn cấu hình (8181) chứa { v: 1, orderId, owner } + CIP-20 (674) hiển thị trên ví
  // Lưu ý giới hạn chuỗi CBOR metadata <= 64 byte của Cardano: chia địa chỉ owner thành các đoạn <= 64 ký tự.
  const aux = C.AuxiliaryData.new()
  const gtm = C.GeneralTransactionMetadata.new()
  const ownerChunks = input.ownerAddress.match(/.{1,60}/g) ?? [input.ownerAddress]
  const orderMetaJson = JSON.stringify({
    v: 1,
    app: 'hydra-pagoda',
    orderId: input.orderId,
    owner: ownerChunks
  })
  gtm.insert(
    C.BigNum.from_str(String(input.metadataLabel)),
    C.encode_json_str_to_metadatum(orderMetaJson, C.MetadataJsonSchema.NoConversions)
  )
  if (input.metadataLabel !== 674) {
    const cip20Json = JSON.stringify({
      msg: ['Van Canh Thien Tu - Nap MC', `Order: ${input.orderId.slice(0, 48)}`]
    })
    gtm.insert(
      C.BigNum.from_str('674'),
      C.encode_json_str_to_metadatum(cip20Json, C.MetadataJsonSchema.NoConversions)
    )
  }
  aux.set_metadata(gtm)
  tb.set_auxiliary_data(aux)

  // 3. Nạp UTxO của ví và chọn đồng (LargestFirst) + tính phí + trả tiền thừa (change)
  const unspent = C.TransactionUnspentOutputs.new()
  let availableLovelace = 0n
  for (const hex of input.utxosHex) {
    if (typeof hex !== 'string' || !/^[0-9a-fA-F]+$/.test(hex)) {
      apiError(400, 'malformed_utxo', 'UTxO từ ví không đúng định dạng hex CBOR')
    }
    try {
      const u = C.TransactionUnspentOutput.from_hex(hex)
      unspent.add(u)
      availableLovelace += BigInt(u.output().amount().coin().to_str())
    } catch {
      apiError(400, 'malformed_utxo', 'Không thể giải mã UTxO từ ví')
    }
  }

  const changeAddr = toWasmAddress(input.changeAddress || input.ownerAddress)
  try {
    tb.add_inputs_from(unspent, C.CoinSelectionStrategyCIP2.LargestFirst)
    tb.add_change_if_needed(changeAddr)
  } catch {
    const needAda = (input.lovelace / 1_000_000).toLocaleString()
    const haveAda = (Number(availableLovelace) / 1_000_000).toLocaleString()
    apiError(
      400,
      'insufficient_utxo_balance',
      `Số dư khả dụng trong ví (${haveAda} ADA) không đủ để trả ${needAda} ADA kèm phí mạng (~0.2 ADA) và min-UTxO.`
    )
  }

  const tx = tb.build_tx()
  const unsignedTxCbor = tx.to_hex()
  const feeLovelace = Number(tx.body().fee().to_str())
  const txHash = C.FixedTransaction.from_hex(unsignedTxCbor).transaction_hash().to_hex()

  return { unsignedTxCbor, txHash, feeLovelace }
}

/**
 * Ghép witness set từ `wallet.signTx(unsignedTxCbor, true)` vào giao dịch chưa ký,
 * hoặc nhận nguyên giao dịch đã ký nếu ví trả về full tx.
 * Đồng thời kiểm tra `txHash` sau khi ghép phải khớp tuyệt đối với `unsignedTxCbor` ban đầu
 * (chặn client tráo đổi nội dung giao dịch khi ký).
 */
export function attachOrderWitness(unsignedTxCbor: string, signedOrWitnessHex: string): { signedTxCbor: string; txHash: string } {
  if (typeof signedOrWitnessHex !== 'string' || !/^[0-9a-fA-F]+$/.test(signedOrWitnessHex)) {
    apiError(400, 'bad_witness', 'Dữ liệu chữ ký giao dịch không hợp lệ')
  }
  const expectedHash = C.FixedTransaction.from_hex(unsignedTxCbor).transaction_hash().to_hex()

  // Thử ghép như TransactionWitnessSet trước (chuẩn CIP-30 signTx)
  try {
    const baseTx = C.Transaction.from_hex(unsignedTxCbor)
    const walletWits = C.TransactionWitnessSet.from_hex(signedOrWitnessHex)
    const vkeys = walletWits.vkeys()
    if (vkeys && vkeys.len() > 0) {
      const wits = baseTx.witness_set()
      wits.set_vkeys(vkeys)
      const signedTx = C.Transaction.new(baseTx.body(), wits, baseTx.auxiliary_data())
      const signedHex = signedTx.to_hex()
      const actualHash = C.FixedTransaction.from_hex(signedHex).transaction_hash().to_hex()
      if (actualHash !== expectedHash) {
        apiError(400, 'tx_hash_mismatch', 'Hash giao dịch sau khi ký không khớp với đơn hàng')
      }
      return { signedTxCbor: signedHex, txHash: actualHash }
    }
  } catch (e: any) {
    if (e?.statusCode) throw e
  }

  // Dự phòng: một số bridge trả về nguyên Transaction đã ký
  try {
    const fullTx = C.Transaction.from_hex(signedOrWitnessHex)
    const vkeys = fullTx.witness_set().vkeys()
    if (!vkeys || vkeys.len() === 0) {
      apiError(400, 'missing_vkey_witness', 'Giao dịch chưa có chữ ký khóa công khai (vkey witness)')
    }
    const actualHash = C.FixedTransaction.from_hex(signedOrWitnessHex).transaction_hash().to_hex()
    if (actualHash !== expectedHash) {
      apiError(400, 'tx_hash_mismatch', 'Giao dịch đã ký không khớp với giao dịch của đơn hàng')
    }
    return { signedTxCbor: signedOrWitnessHex, txHash: actualHash }
  } catch (e: any) {
    if (e?.statusCode) throw e
    apiError(400, 'bad_witness', 'Không thể ghép chữ ký giao dịch từ ví')
  }
}

