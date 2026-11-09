/**
 * Dựng & ký giao dịch Hydra L2 (fee = 0) bằng `@hydra-sdk/cardano-wasm`.
 *
 * Mô hình UTxO trong Head:
 *  - Fuel Pool: các UTxO "mồi" thuộc khóa Fuel của máy chủ (được commit vào Head), trả phí/biên độ lovelace.
 *  - State UTxO của mỗi tài khoản: nằm ở địa chỉ Session Key (`l2_address`), mang inline datum
 *    `Constr 0 [balanceAfter, ledgerId, deltaMc, accountId]`. Mỗi bút toán MC tiêu State UTxO cũ (nếu có) +
 *    1 Fuel UTxO và tạo State UTxO mới + Fuel change => luôn có đúng 1 State UTxO/tài khoản.
 *  - Metadata CIP-20 (nhãn 674) mô tả hành động để audit.
 *
 * Khóa riêng KHÔNG bao giờ rời máy chủ: dẫn xuất tất định bằng HMAC-SHA256(serverSecret, nhãn).
 */
import { createHmac } from 'node:crypto'
import { DEFAULT_PROTOCOL_PARAMETERS } from '@hydra-sdk/core'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { getWalletConfig } from '../wallet/config'

export interface L2Key {
    sk: C.PrivateKey
    vkeyHex: string
    address: C.Address
    bech32: string
}

export interface L2Utxo {
    /** "txhash#index" */
    ref: string
    lovelace: number
}

export interface BuiltL2Tx {
    cborHex: string
    txHash: string
    /** lovelace của Fuel change (output index 1) nếu có */
    changeLovelace: number
    stateLovelace: number
}

function hexOf(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('hex')
}

function deriveKey(secret: string, label: string): L2Key {
    const seed = createHmac('sha256', secret).update(label).digest()
    const sk = C.PrivateKey.from_normal_bytes(new Uint8Array(seed))
    const pk = sk.to_public()
    const networkId = getWalletConfig().networkId
    const address = C.EnterpriseAddress.new(networkId, C.Credential.from_keyhash(pk.hash())).to_address()
    return { sk, vkeyHex: hexOf(pk.as_bytes()), address, bech32: address.to_bech32(undefined) }
}

/** Khóa Fuel của máy chủ (một khóa cho cả Fuel Pool). */
export function deriveFuelKey(secret: string): L2Key {
    return deriveKey(secret, 'hydra-pagoda:l2-fuel:v1')
}

/** Session Ephemeral Key của một tài khoản (ràng buộc accountId + địa chỉ L1 đã chứng minh bằng CIP-8). */
export function deriveSessionKey(secret: string, accountId: number, l1Address: string): L2Key {
    return deriveKey(secret, `hydra-pagoda:l2-session:v1:${accountId}:${l1Address}`)
}

function newBuilder(): C.TransactionBuilder {
    const P = DEFAULT_PROTOCOL_PARAMETERS
    const cfg = C.TransactionBuilderConfigBuilder.new()
        .fee_algo(C.LinearFee.new(C.BigNum.from_str('0'), C.BigNum.from_str('0')))
        .pool_deposit(C.BigNum.from_str(String(P.poolDeposit)))
        .key_deposit(C.BigNum.from_str(String(P.keyDeposit)))
        .max_value_size(Number(P.maxValSize))
        .max_tx_size(Number(P.maxTxSize))
        .coins_per_utxo_byte(C.BigNum.from_str(String(P.coinsPerUtxoSize)))
        .build()
    return C.TransactionBuilder.new(cfg)
}

function toInput(ref: string): C.TransactionInput {
    const [txid, idx] = ref.split('#')
    if (!txid || !/^[0-9a-fA-F]{64}$/.test(txid) || !/^\d+$/.test(idx ?? '')) throw new Error(`bad_utxo_ref:${ref}`)
    return C.TransactionInput.new(C.TransactionHash.from_hex(txid.toLowerCase()), Number(idx))
}

function lovelaceValue(n: number): C.Value {
    return C.Value.new(C.BigNum.from_str(String(Math.floor(n))))
}

/** Cắt chuỗi thành các đoạn <= 64 byte (giới hạn của metadata text Cardano). */
export function chunk64(text: string): string[] {
    const clean = String(text).replace(/[^\x20-\x7E]/g, '?')
    return clean.match(/.{1,64}/g) ?? ['']
}

export function buildCip20Lines(p: { reason: string; deltaMc: number; l1Address: string; refId: string }): string[] {
    const sign = p.deltaMc > 0 ? '+' : ''
    return [
        'Van Canh Thien Tu - Hydra L2 MC Ledger',
        ...chunk64(`Action: ${p.reason} (${sign}${p.deltaMc} MC)`),
        ...chunk64(`Account: ${p.l1Address}`),
        ...chunk64(`Receipt: mc_${p.reason}_${p.refId}`)
    ]
}

function attachMetadata(tb: C.TransactionBuilder, lines: string[]) {
    const aux = C.AuxiliaryData.new()
    const gtm = C.GeneralTransactionMetadata.new()
    gtm.insert(
        C.BigNum.from_str('674'),
        C.encode_json_str_to_metadatum(JSON.stringify({ msg: lines }), C.MetadataJsonSchema.NoConversions)
    )
    aux.set_metadata(gtm)
    tb.set_auxiliary_data(aux)
}

function finalize(tb: C.TransactionBuilder, signers: L2Key[]): { cborHex: string; txHash: string } {
    const tx = tb.build_tx()
    const fixed = C.FixedTransaction.from_hex(tx.to_hex())
    for (const k of signers) fixed.sign_and_add_vkey_signature(k.sk)
    const cborHex = fixed.to_hex()
    const txHash = C.FixedTransaction.from_hex(cborHex).transaction_hash().to_hex()
    return { cborHex, txHash }
}

/**
 * Bút toán MC -> giao dịch L2: tiêu Fuel UTxO (+ State UTxO cũ), tạo State UTxO mới (inline datum) + Fuel change.
 * Output 0 = State UTxO mới (ở l2_address), Output 1 = Fuel change (nếu > 0).
 */
export function buildL2LedgerTx(p: {
    fuelKey: L2Key
    sessionKey: L2Key
    fuelInput: L2Utxo
    stateInput?: L2Utxo | null
    stateLovelace: number
    datumFields: number[]
    metadataLines: string[]
}): BuiltL2Tx {
    const tb = newBuilder()
    tb.add_regular_input(p.fuelKey.address, toInput(p.fuelInput.ref), lovelaceValue(p.fuelInput.lovelace))
    let totalIn = p.fuelInput.lovelace
    if (p.stateInput) {
        tb.add_regular_input(p.sessionKey.address, toInput(p.stateInput.ref), lovelaceValue(p.stateInput.lovelace))
        totalIn += p.stateInput.lovelace
    }

    const datum = C.encode_json_str_to_plutus_datum(
        JSON.stringify({ constructor: 0, fields: p.datumFields.map(n => ({ int: n })) }),
        C.PlutusDatumSchema.DetailedSchema
    )
    const stateOut = C.TransactionOutput.new(p.sessionKey.address, lovelaceValue(p.stateLovelace))
    stateOut.set_plutus_data(datum)
    tb.add_output(stateOut)

    const change = totalIn - p.stateLovelace
    if (change < 0) throw new Error('l2_insufficient_fuel')
    if (change > 0) tb.add_output(C.TransactionOutput.new(p.fuelKey.address, lovelaceValue(change)))

    tb.set_fee(C.BigNum.from_str('0'))
    attachMetadata(tb, p.metadataLines)

    const signers = p.stateInput ? [p.fuelKey, p.sessionKey] : [p.fuelKey]
    const { cborHex, txHash } = finalize(tb, signers)
    return { cborHex, txHash, changeLovelace: change, stateLovelace: p.stateLovelace }
}

/** Chia 1 Fuel UTxO lớn thành `count` UTxO nhỏ (Fuel Pool) để tránh BadInputsUTxO khi nhiều tx liên tiếp. */
export function buildFuelSplitTx(p: {
    fuelKey: L2Key
    input: L2Utxo
    count: number
}): { cborHex: string; txHash: string; outputs: number[] } {
    const tb = newBuilder()
    tb.add_regular_input(p.fuelKey.address, toInput(p.input.ref), lovelaceValue(p.input.lovelace))
    const each = Math.floor(p.input.lovelace / p.count)
    const outputs: number[] = []
    for (let i = 0; i < p.count; i++) {
        const amount = i === p.count - 1 ? p.input.lovelace - each * (p.count - 1) : each
        outputs.push(amount)
        tb.add_output(C.TransactionOutput.new(p.fuelKey.address, lovelaceValue(amount)))
    }
    tb.set_fee(C.BigNum.from_str('0'))
    attachMetadata(tb, ['Van Canh Thien Tu - Hydra L2 Fuel Pool split', `Outputs: ${p.count}`])
    const { cborHex, txHash } = finalize(tb, [p.fuelKey])
    return { cborHex, txHash, outputs }
}
