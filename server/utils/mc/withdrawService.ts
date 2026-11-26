/**
 * Dịch vụ Rút MC từ số dư Hydra L2 về ví Eternl L1 bằng giao dịch ký 2 bên (eUTxO Co-sign).
 *
 * Ưu điểm kiến trúc Cardano eUTxO:
 * - Người chơi tự dùng ~1,25 ADA trong ví của chính mình để bọc gói MC trả về chính ví họ (KHÔNG mất 1,25 ADA),
 *   chỉ trả đúng ~0,18 ADA phí mạng Cardano.
 * - Ví Quỹ Nóng (Hot Vault) chỉ đưa đúng `mcAmount` MC và thu hồi lại đủ 100% ADA của mình -> tốn 0 ADA!
 * - Nếu dựng tx lỗi hoặc người chơi bấm Hủy trong Eternl -> tự động hoàn trả 100% MC về lại số dư Hydra L2.
 */
import { randomBytes } from 'node:crypto'
import { DEFAULT_PROTOCOL_PARAMETERS } from '@hydra-sdk/core'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { MC_ASSET_NAME_HEX } from '../../../lib/mc/tokenomics'
import { apiError, type PublicAccount } from '../wallet/auth'
import { getWalletConfig } from '../wallet/config'
import { getDb, onAfterCommit, withTransaction } from '../wallet/db'
import { scheduleHydraRecord } from '../hydra/hydraQueue'
import type { DecodedUtxo } from '../wallet/txBuilder'

export const MIN_WITHDRAW_MC = 500
const WITHDRAW_TTL_MS = 3 * 60_000

function getHotVaultSettings() {
  const cfg = getWalletConfig()
  const skeyHex = (process.env.MC_HOT_VAULT_SKEY_HEX || process.env.MC_POLICY_SKEY_HEX || '').trim()
  const policyId = (process.env.NUXT_MC_POLICY_ID || '').trim().toLowerCase()
  if (!skeyHex || !policyId || !cfg.blockfrostApiKey) {
    apiError(503, 'withdraw_not_configured', 'Cổng rút MC L1 chưa được cấu hình (thiếu Policy ID hoặc Ví Quỹ Nóng)')
  }
  const privKey = C.PrivateKey.from_normal_bytes(Buffer.from(skeyHex, 'hex'))
  const hotAddr = C.EnterpriseAddress.new(cfg.networkId, C.Credential.from_keyhash(privKey.to_public().hash())).to_address()
  return {
    cfg,
    privKey,
    hotAddr,
    hotBech32: hotAddr.to_bech32(),
    policyId,
    assetUnit: `${policyId}${MC_ASSET_NAME_HEX}`
  }
}

function toWasmAddress(raw: string): C.Address {
  const clean = raw.trim()
  try {
    return clean.startsWith('addr') ? C.Address.from_bech32(clean) : C.Address.from_hex(clean)
  } catch {
    try {
      return C.Address.from_hex(clean)
    } catch {
      apiError(400, 'bad_address', 'Địa chỉ ví nhận không hợp lệ')
    }
  }
}

function toWasmUtxo(raw: unknown): C.TransactionUnspentOutput {
  if (typeof raw === 'string') {
    const hex = raw.trim()
    if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
      apiError(400, 'malformed_utxo', 'UTxO từ ví không đúng định dạng hex CBOR')
    }
    return C.TransactionUnspentOutput.from_hex(hex)
  }
  const c = raw as Partial<DecodedUtxo>
  if (!c?.input?.txHash || !c?.output?.address || !Array.isArray(c?.output?.amount)) {
    apiError(400, 'malformed_utxo', 'UTxO từ ví không hợp lệ')
  }
  let lovelace = '0'
  const ma = C.MultiAsset.new()
  let hasAsset = false
  for (const a of c.output.amount) {
    if (a.unit === 'lovelace') lovelace = String(a.quantity)
    else if (a.unit.length >= 56) {
      const pid = C.ScriptHash.from_bytes(Buffer.from(a.unit.slice(0, 56), 'hex'))
      const aname = C.AssetName.new(Buffer.from(a.unit.slice(56), 'hex'))
      const ex = ma.get(pid) || C.Assets.new()
      ex.insert(aname, C.BigNum.from_str(String(a.quantity)))
      ma.insert(pid, ex)
      hasAsset = true
    }
  }
  const val = hasAsset ? C.Value.new_with_assets(C.BigNum.from_str(lovelace), ma) : C.Value.new(C.BigNum.from_str(lovelace))
  return C.TransactionUnspentOutput.new(
    C.TransactionInput.new(C.TransactionHash.from_bytes(Buffer.from(c.input.txHash, 'hex')), Number(c.input.outputIndex)),
    C.TransactionOutput.new(toWasmAddress(c.output.address), val)
  )
}

async function bfGet(bfBase: string, bfKey: string, path: string) {
  const res = await fetch(`${bfBase}${path}`, { headers: { project_id: bfKey } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Blockfrost ${path} -> HTTP ${res.status}`)
  return res.json()
}

/** Hoàn trả MC về số dư L2 nếu bước dựng tx thất bại hoặc người dùng hủy ký trên Eternl. */
export async function cancelAndRefundWithdraw(account: PublicAccount, withdrawId: string, reason = 'user_cancelled') {
  const cleanId = withdrawId.trim()
  if (!cleanId) apiError(400, 'invalid_withdraw_id', 'Thiếu mã lệnh rút')

  return withTransaction(async (conn) => {
    const row = (await conn.prepare('SELECT * FROM mc_withdrawals WHERE withdraw_id = ?').get(cleanId)) as any
    if (!row) apiError(404, 'withdraw_not_found', 'Không tìm thấy lệnh rút MC')
    if (Number(row.account_id) !== account.id) apiError(403, 'forbidden', 'Lệnh rút thuộc về ví khác')

    if (row.status === 'refunded') {
      const acc = (await conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(account.id)) as { mc_balance: number }
      return { withdrawId: cleanId, status: 'refunded', refundedMc: 0, newBalance: acc.mc_balance }
    }
    if (row.status !== 'pending') {
      apiError(409, 'cannot_cancel', `Lệnh rút đang ở trạng thái ${row.status}, không thể hủy`)
    }

    const now = Date.now()
    const amount = Number(row.mc_amount)
    await conn
      .prepare("UPDATE mc_withdrawals SET status = 'refunded', failure_reason = ?, settled_at = ? WHERE withdraw_id = ?")
      .run(reason, now, cleanId)
    await conn.prepare('UPDATE accounts SET mc_balance = mc_balance + ? WHERE id = ?').run(amount, account.id)
    const afterAcc = (await conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(account.id)) as { mc_balance: number }

    const ins = await conn
      .prepare(
        `INSERT INTO mc_ledger (account_id, delta_mc, balance_after, reason, ref_type, ref_id, tx_hash, metadata_json, created_at)
         VALUES (?, ?, ?, 'mc_withdraw_refund', 'withdraw', ?, NULL, ?, ?)`
      )
      .run(account.id, amount, afterAcc.mc_balance, `${cleanId}_refund`, JSON.stringify({ withdrawId: cleanId, reason }), now)

    const ledgerId = Number(ins.lastInsertRowid)
    onAfterCommit(() => {
      if (ledgerId > 0) void scheduleHydraRecord(ledgerId)
    })

    return { withdrawId: cleanId, status: 'refunded', refundedMc: amount, newBalance: afterAcc.mc_balance }
  })
}

/**
 * Bước 1 (Build): Trừ tạm MC trên L2 + dựng giao dịch Co-sign 2 bên (Hot Vault góp MC, User góp min-UTxO & phí mạng).
 */
export async function buildWithdrawCoSignTx(
  account: PublicAccount,
  input: { mcAmount?: unknown; utxos?: unknown; changeAddress?: unknown }
) {
  const mcAmount = Math.floor(Number(input.mcAmount))
  if (!Number.isSafeInteger(mcAmount) || mcAmount < MIN_WITHDRAW_MC) {
    apiError(400, 'below_min_withdraw', `Số MC rút tối thiểu là ${MIN_WITHDRAW_MC.toLocaleString()} MC`)
  }
  if (!Array.isArray(input.utxos) || input.utxos.length === 0) {
    apiError(400, 'missing_utxos', 'Ví Eternl cần có ít nhất ~2 ADA để trả phí mạng & giữ min-UTxO')
  }
  const rawChange = typeof input.changeAddress === 'string' && input.changeAddress.trim() ? input.changeAddress.trim() : account.address
  const userChangeAddr = toWasmAddress(rawChange)
  const hot = getHotVaultSettings()

  const withdrawId = `wd_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`
  const now = Date.now()
  const expiresAt = now + WITHDRAW_TTL_MS

  // 1. Trừ nguyên tử số dư L2 & khóa bản ghi mc_withdrawals (status='pending')
  const reserved = await withTransaction(async (conn) => {
    const upd = await conn
      .prepare('UPDATE accounts SET mc_balance = mc_balance - ? WHERE id = ? AND mc_balance >= ?')
      .run(mcAmount, account.id, mcAmount)
    if (Number(upd.changes) !== 1) {
      apiError(400, 'insufficient_mc_balance', 'Số dư MC trên L2 không đủ để rút')
    }
    const acc = (await conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(account.id)) as { mc_balance: number }

    await conn
      .prepare(
        `INSERT INTO mc_withdrawals (withdraw_id, account_id, wallet_address, mc_amount, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`
      )
      .run(withdrawId, account.id, account.address, mcAmount, now, expiresAt)

    const ins = await conn
      .prepare(
        `INSERT INTO mc_ledger (account_id, delta_mc, balance_after, reason, ref_type, ref_id, tx_hash, metadata_json, created_at)
         VALUES (?, ?, ?, 'mc_withdraw_l2_to_l1', 'withdraw', ?, NULL, ?, ?)`
      )
      .run(account.id, -mcAmount, acc.mc_balance, withdrawId, JSON.stringify({ withdrawId, mcAmount }), now)

    const ledgerId = Number(ins.lastInsertRowid)
    onAfterCommit(() => {
      if (ledgerId > 0) void scheduleHydraRecord(ledgerId)
    })
    return { newBalance: acc.mc_balance }
  })

  // 2. Dựng giao dịch eUTxO Co-sign (nếu lỗi bất kỳ bước nào -> tự động hoàn MC lại L2 ngay!)
  try {
    const [vaultUtxos, params] = await Promise.all([
      bfGet(hot.cfg.blockfrostBaseUrl, hot.cfg.blockfrostApiKey, `/addresses/${hot.hotBech32}/utxos`),
      bfGet(hot.cfg.blockfrostBaseUrl, hot.cfg.blockfrostApiKey, '/epochs/latest/parameters').catch(() => null)
    ])

    if (!Array.isArray(vaultUtxos) || vaultUtxos.length === 0) {
      throw new Error('Ví Quỹ Nóng chưa có UTxO MC trên chuỗi')
    }

    // Chọn UTxO từ Ví Quỹ Nóng chứa đủ mcAmount
    const pickedVault: any[] = []
    let vaultLovelace = 0n
    let vaultMc = 0n
    const otherVaultAssets = new Map<string, bigint>()

    for (const u of vaultUtxos) {
      const hasMc = (u.amount || []).some((a: any) => a.unit === hot.assetUnit && BigInt(a.quantity) > 0n)
      if (!hasMc) continue
      pickedVault.push(u)
      for (const a of u.amount || []) {
        if (a.unit === 'lovelace') vaultLovelace += BigInt(a.quantity)
        else if (a.unit === hot.assetUnit) vaultMc += BigInt(a.quantity)
        else otherVaultAssets.set(a.unit, (otherVaultAssets.get(a.unit) ?? 0n) + BigInt(a.quantity))
      }
      if (vaultMc >= BigInt(mcAmount)) break
    }

    if (vaultMc < BigInt(mcAmount)) {
      throw new Error(`Ví Quỹ Nóng chỉ còn ${vaultMc.toString()} MC, chưa đủ rút ${mcAmount.toLocaleString()} MC`)
    }

    const coinsPerByte = String(params?.coins_per_utxo_size || DEFAULT_PROTOCOL_PARAMETERS.coinsPerUtxoByte || '4310')
    const cfgBuilder = C.TransactionBuilderConfigBuilder.new()
      .fee_algo(
        C.LinearFee.new(
          C.BigNum.from_str(String(params?.min_fee_a ?? DEFAULT_PROTOCOL_PARAMETERS.minFeeA)),
          C.BigNum.from_str(String(params?.min_fee_b ?? DEFAULT_PROTOCOL_PARAMETERS.minFeeB))
        )
      )
      .pool_deposit(C.BigNum.from_str(String(params?.pool_deposit ?? DEFAULT_PROTOCOL_PARAMETERS.poolDeposit)))
      .key_deposit(C.BigNum.from_str(String(params?.key_deposit ?? DEFAULT_PROTOCOL_PARAMETERS.keyDeposit)))
      .coins_per_utxo_byte(C.BigNum.from_str(coinsPerByte))
      .max_value_size(Number(params?.max_val_size ?? 5000))
      .max_tx_size(Number(params?.max_tx_size ?? 16384))
      .build()

    const txBuilder = C.TransactionBuilder.new(cfgBuilder)
    const policyHash = C.ScriptHash.from_bytes(Buffer.from(hot.policyId, 'hex'))
    const assetName = C.AssetName.new(Buffer.from(MC_ASSET_NAME_HEX, 'hex'))

    // Nạp input từ Ví Quỹ Nóng
    for (const u of pickedVault) {
      let lv = '0'
      const ma = C.MultiAsset.new()
      let hasA = false
      for (const a of u.amount || []) {
        if (a.unit === 'lovelace') lv = a.quantity
        else if (a.unit.length >= 56) {
          const pid = C.ScriptHash.from_bytes(Buffer.from(a.unit.slice(0, 56), 'hex'))
          const aname = C.AssetName.new(Buffer.from(a.unit.slice(56), 'hex'))
          const ex = ma.get(pid) || C.Assets.new()
          ex.insert(aname, C.BigNum.from_str(a.quantity))
          ma.insert(pid, ex)
          hasA = true
        }
      }
      const val = hasA ? C.Value.new_with_assets(C.BigNum.from_str(lv), ma) : C.Value.new(C.BigNum.from_str(lv))
      txBuilder.add_regular_input(
        hot.hotAddr,
        C.TransactionInput.new(C.TransactionHash.from_bytes(Buffer.from(u.tx_hash, 'hex')), Number(u.output_index)),
        val
      )
    }

    // Output 1: Gửi MC thật về ví người chơi kèm min-UTxO (từ chính ADA của người chơi -> không mất cọc!)
    const userMcMa = C.MultiAsset.new()
    const userMcAssets = C.Assets.new()
    userMcAssets.insert(assetName, C.BigNum.from_str(String(mcAmount)))
    userMcMa.insert(policyHash, userMcAssets)
    const dataCost = C.DataCost.new_coins_per_byte(C.BigNum.from_str(coinsPerByte))
    const dummyUserOut = C.TransactionOutput.new(userChangeAddr, C.Value.new_with_assets(C.BigNum.from_str('1500000'), userMcMa))
    const minUserLovelace = C.min_ada_for_output(dummyUserOut, dataCost).checked_add(C.BigNum.from_str('50000'))
    txBuilder.add_output(C.TransactionOutput.new(userChangeAddr, C.Value.new_with_assets(minUserLovelace, userMcMa)))

    // Output 2: Trả lại ĐỦ 100% ADA + phần MC còn dư về Ví Quỹ Nóng (Chùa tốn 0 ADA!)
    const remainMc = vaultMc - BigInt(mcAmount)
    const vaultRetMa = C.MultiAsset.new()
    let hasVaultRetAsset = false
    if (remainMc > 0n) {
      const a = C.Assets.new()
      a.insert(assetName, C.BigNum.from_str(remainMc.toString()))
      vaultRetMa.insert(policyHash, a)
      hasVaultRetAsset = true
    }
    for (const [unit, qty] of otherVaultAssets.entries()) {
      if (qty <= 0n || unit.length < 56) continue
      const pid = C.ScriptHash.from_bytes(Buffer.from(unit.slice(0, 56), 'hex'))
      const aname = C.AssetName.new(Buffer.from(unit.slice(56), 'hex'))
      const ex = vaultRetMa.get(pid) || C.Assets.new()
      ex.insert(aname, C.BigNum.from_str(qty.toString()))
      vaultRetMa.insert(pid, ex)
      hasVaultRetAsset = true
    }
    const vaultRetVal = hasVaultRetAsset
      ? C.Value.new_with_assets(C.BigNum.from_str(vaultLovelace.toString()), vaultRetMa)
      : C.Value.new(C.BigNum.from_str(vaultLovelace.toString()))
    txBuilder.add_output(C.TransactionOutput.new(hot.hotAddr, vaultRetVal))

    // Nạp UTxO của người chơi để bù min-UTxO (trả về chính họ) + ~0,18 ADA phí mạng
    const userUnspent = C.TransactionUnspentOutputs.new()
    for (const raw of input.utxos) {
      userUnspent.add(toWasmUtxo(raw))
    }
    txBuilder.add_inputs_from(userUnspent, C.CoinSelectionStrategyCIP2.LargestFirstMultiAsset)
    txBuilder.add_change_if_needed(userChangeAddr)

    const txBody = txBuilder.build()
    const unsignedTx = C.Transaction.new(txBody, C.TransactionWitnessSet.new())
    const unsignedTxCbor = Buffer.from(unsignedTx.to_bytes()).toString('hex')
    const txHash = Buffer.from(C.FixedTransaction.new_from_body_bytes(txBody.to_bytes()).transaction_hash().to_bytes()).toString('hex')

    const db = await getDb()
    await db
      .prepare('UPDATE mc_withdrawals SET unsigned_tx_hash = ?, unsigned_tx_cbor = ? WHERE withdraw_id = ?')
      .run(txHash, unsignedTxCbor, withdrawId)

    return {
      withdrawId,
      unsignedTxCbor,
      txHash,
      mcAmount,
      expiresAt,
      newBalance: reserved.newBalance
    }
  } catch (e: any) {
    // Tự động hoàn trả MC lại L2 khi dựng tx lỗi
    await cancelAndRefundWithdraw(account, withdrawId, `build_failed:${e?.message || 'unknown'}`).catch(() => {})
    apiError(400, 'withdraw_build_failed', e?.message || 'Không thể dựng giao dịch rút MC. Số dư L2 đã được hoàn lại.')
  }
}

/**
 * Bước 2 (Co-sign): Ghép chữ ký người chơi (từ Eternl `signTx(..., true)`) + chữ ký Ví Quỹ Nóng.
 */
export async function cosignWithdrawTx(
  account: PublicAccount,
  input: { withdrawId?: unknown; userWitnessSetCbor?: unknown }
) {
  const withdrawId = typeof input.withdrawId === 'string' ? input.withdrawId.trim() : ''
  const userWitnessHex = typeof input.userWitnessSetCbor === 'string' ? input.userWitnessSetCbor.trim() : ''
  if (!withdrawId) apiError(400, 'invalid_withdraw_id', 'Thiếu mã lệnh rút')
  if (!userWitnessHex || !/^[0-9a-fA-F]+$/.test(userWitnessHex)) {
    apiError(400, 'invalid_witness', 'Chữ ký ví không hợp lệ')
  }

  const db = await getDb()
  const row = (await db.prepare('SELECT * FROM mc_withdrawals WHERE withdraw_id = ?').get(withdrawId)) as any
  if (!row) apiError(404, 'withdraw_not_found', 'Không tìm thấy lệnh rút MC')
  if (Number(row.account_id) !== account.id) apiError(403, 'forbidden', 'Lệnh rút thuộc về ví khác')
  if (row.status !== 'pending' || !row.unsigned_tx_cbor) {
    apiError(409, 'invalid_withdraw_state', `Lệnh rút đang ở trạng thái ${row.status}`)
  }
  if (Date.now() > Number(row.expires_at)) {
    await cancelAndRefundWithdraw(account, withdrawId, 'expired')
    apiError(410, 'withdraw_expired', 'Lệnh rút đã hết hạn, số dư L2 đã được hoàn lại')
  }

  const hot = getHotVaultSettings()
  const unsignedTx = C.Transaction.from_bytes(Buffer.from(row.unsigned_tx_cbor, 'hex'))
  const txBody = unsignedTx.body()
  const txHashObj = C.FixedTransaction.new_from_body_bytes(txBody.to_bytes()).transaction_hash()
  const txHash = Buffer.from(txHashObj.to_bytes()).toString('hex')

  const userWs = C.TransactionWitnessSet.from_bytes(Buffer.from(userWitnessHex, 'hex'))
  const mergedVkeys = C.Vkeywitnesses.new()
  const existingVkeys = userWs.vkeys()
  if (existingVkeys) {
    for (let i = 0; i < existingVkeys.len(); i++) {
      mergedVkeys.add(existingVkeys.get(i))
    }
  }
  mergedVkeys.add(C.make_vkey_witness(txHashObj, hot.privKey))

  const finalWs = C.TransactionWitnessSet.new()
  finalWs.set_vkeys(mergedVkeys)
  const signedTx = C.Transaction.new(txBody, finalWs)
  const signedTxCbor = Buffer.from(signedTx.to_bytes()).toString('hex')

  await db
    .prepare("UPDATE mc_withdrawals SET status = 'submitted', tx_hash = ?, settled_at = ? WHERE withdraw_id = ?")
    .run(txHash, Date.now(), withdrawId)

  const explorerBase = hot.cfg.isTestnet ? 'https://preprod.cardanoscan.io' : 'https://cardanoscan.io'
  return {
    withdrawId,
    signedTxCbor,
    txHash,
    mcAmount: Number(row.mc_amount),
    explorerUrl: `${explorerBase}/transaction/${txHash}`
  }
}
