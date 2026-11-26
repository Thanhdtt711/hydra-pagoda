/**
 * Tự động gửi MC Native Asset thật trên Cardano L1 (Preprod / Mainnet) từ Ví Quỹ Nóng (Hot Vault)
 * sang ví Eternl / Lace của người mua ngay sau khi giao dịch thanh toán ADA được xác nhận.
 *
 * Bảo mật & chống xung đột UTxO:
 * - Khóa ví nóng đọc từ `MC_HOT_VAULT_SKEY_HEX` (hoặc `MC_POLICY_SKEY_HEX` trên Preprod).
 * - Khi lên Mainnet: dùng ví nóng riêng chỉ chứa lượng MC vừa đủ phát theo ngày, phần lớn cất ví lạnh.
 * - Xếp hàng tuần tự (`deliveryChain`) để hai đơn mua cùng lúc không tiêu trùng cùng 1 UTxO của ví nóng.
 */
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { MC_ASSET_NAME_HEX } from '../../../lib/mc/tokenomics'
import { getWalletConfig } from '../wallet/config'

export interface McDeliveryResult {
  ok: boolean
  skipped?: boolean
  txHash?: string
  hotVaultAddress?: string
  error?: string
}

let deliveryChain: Promise<unknown> = Promise.resolve()

function getHotVaultConfig() {
  const cfg = getWalletConfig()
  const skeyHex = (process.env.MC_HOT_VAULT_SKEY_HEX || process.env.MC_POLICY_SKEY_HEX || '').trim()
  const policyId = (process.env.NUXT_MC_POLICY_ID || '').trim().toLowerCase()
  const enabled = process.env.MC_ONCHAIN_DELIVERY_ENABLED !== 'false'
  return {
    enabled,
    skeyHex,
    policyId,
    assetUnit: policyId ? `${policyId}${MC_ASSET_NAME_HEX}` : '',
    bfKey: cfg.blockfrostApiKey,
    bfBase: cfg.blockfrostBaseUrl,
    networkId: cfg.networkId
  }
}

async function bfGet(bfBase: string, bfKey: string, path: string) {
  const res = await fetch(`${bfBase}${path}`, { headers: { project_id: bfKey } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Blockfrost GET ${path} -> HTTP ${res.status}`)
  return res.json()
}

async function executeDelivery(buyerAddress: string, mcAmount: number, refId: string): Promise<McDeliveryResult> {
  const hcfg = getHotVaultConfig()
  if (!hcfg.enabled) return { ok: false, skipped: true, error: 'MC_ONCHAIN_DELIVERY_ENABLED=false' }
  if (!hcfg.skeyHex || !hcfg.policyId || !hcfg.bfKey) {
    return { ok: false, skipped: true, error: 'Chưa cấu hình MC_HOT_VAULT_SKEY_HEX / NUXT_MC_POLICY_ID / Blockfrost' }
  }
  if (!Number.isSafeInteger(mcAmount) || mcAmount <= 0) {
    return { ok: false, error: 'Số lượng MC giao không hợp lệ' }
  }

  try {
    const privKey = C.PrivateKey.from_normal_bytes(Buffer.from(hcfg.skeyHex, 'hex'))
    const pubKeyHash = privKey.to_public().hash()
    const hotAddr = C.EnterpriseAddress.new(hcfg.networkId, C.Credential.from_keyhash(pubKeyHash)).to_address()
    const hotBech32 = hotAddr.to_bech32()

    const [utxos, params] = await Promise.all([
      bfGet(hcfg.bfBase, hcfg.bfKey, `/addresses/${hotBech32}/utxos`),
      bfGet(hcfg.bfBase, hcfg.bfKey, '/epochs/latest/parameters')
    ])

    if (!Array.isArray(utxos) || utxos.length === 0) {
      return { ok: false, hotVaultAddress: hotBech32, error: `Ví quỹ nóng ${hotBech32} chưa có UTxO` }
    }

    // Kiểm tra tổng MC có sẵn trong ví quỹ nóng
    let availableMc = 0n
    for (const u of utxos) {
      for (const a of u.amount || []) {
        if (a.unit === hcfg.assetUnit) availableMc += BigInt(a.quantity)
      }
    }
    if (availableMc < BigInt(mcAmount)) {
      return {
        ok: false,
        hotVaultAddress: hotBech32,
        error: `Ví quỹ nóng ${hotBech32} chỉ còn ${availableMc.toString()} MC, chưa đủ giao ${mcAmount} MC (hãy chuyển MC từ ví lạnh sang ví quỹ nóng).`
      }
    }

    const coinsPerByte = String(params.coins_per_utxo_size || '4310')
    const cfgBuilder = C.TransactionBuilderConfigBuilder.new()
      .fee_algo(C.LinearFee.new(C.BigNum.from_str(String(params.min_fee_a)), C.BigNum.from_str(String(params.min_fee_b))))
      .pool_deposit(C.BigNum.from_str(String(params.pool_deposit)))
      .key_deposit(C.BigNum.from_str(String(params.key_deposit)))
      .coins_per_utxo_byte(C.BigNum.from_str(coinsPerByte))
      .max_value_size(Number(params.max_val_size || 5000))
      .max_tx_size(Number(params.max_tx_size || 16384))
      .build()

    const txBuilder = C.TransactionBuilder.new(cfgBuilder)
    const policyHash = C.ScriptHash.from_bytes(Buffer.from(hcfg.policyId, 'hex'))
    const assetName = C.AssetName.new(Buffer.from(MC_ASSET_NAME_HEX, 'hex'))

    // Tạo output gửi MC thật về ví người mua kèm min-ADA đúng chuẩn Cardano
    const outMulti = C.MultiAsset.new()
    const outAssets = C.Assets.new()
    outAssets.insert(assetName, C.BigNum.from_str(String(mcAmount)))
    outMulti.insert(policyHash, outAssets)

    const buyerAddrObj = C.Address.from_bech32(buyerAddress)
    const dummyOut = C.TransactionOutput.new(buyerAddrObj, C.Value.new_with_assets(C.BigNum.from_str('1500000'), outMulti))
    const dataCost = C.DataCost.new_coins_per_byte(C.BigNum.from_str(coinsPerByte))
    const minLovelace = C.min_ada_for_output(dummyOut, dataCost).checked_add(C.BigNum.from_str('50000'))
    const finalOut = C.TransactionOutput.new(buyerAddrObj, C.Value.new_with_assets(minLovelace, outMulti))
    txBuilder.add_output(finalOut)

    // Nạp toàn bộ UTxO của ví quỹ nóng (gồm cả lovelace và multi-asset)
    const unspent = C.TransactionUnspentOutputs.new()
    for (const u of utxos) {
      let lovelace = '0'
      const ma = C.MultiAsset.new()
      let hasAsset = false
      for (const a of u.amount || []) {
        if (a.unit === 'lovelace') {
          lovelace = a.quantity
        } else if (a.unit.length >= 56) {
          const pid = C.ScriptHash.from_bytes(Buffer.from(a.unit.slice(0, 56), 'hex'))
          const aname = C.AssetName.new(Buffer.from(a.unit.slice(56), 'hex'))
          const existing = ma.get(pid) || C.Assets.new()
          existing.insert(aname, C.BigNum.from_str(a.quantity))
          ma.insert(pid, existing)
          hasAsset = true
        }
      }
      const val = hasAsset
        ? C.Value.new_with_assets(C.BigNum.from_str(lovelace), ma)
        : C.Value.new(C.BigNum.from_str(lovelace))
      unspent.add(
        C.TransactionUnspentOutput.new(
          C.TransactionInput.new(C.TransactionHash.from_bytes(Buffer.from(u.tx_hash, 'hex')), Number(u.output_index)),
          C.TransactionOutput.new(hotAddr, val)
        )
      )
    }

    txBuilder.add_inputs_from(unspent, C.CoinSelectionStrategyCIP2.LargestFirstMultiAsset)
    txBuilder.add_change_if_needed(hotAddr)

    const txBody = txBuilder.build()
    const txHashObj = C.FixedTransaction.new_from_body_bytes(txBody.to_bytes()).transaction_hash()
    const vkeys = C.Vkeywitnesses.new()
    vkeys.add(C.make_vkey_witness(txHashObj, privKey))
    const witnessSet = C.TransactionWitnessSet.new()
    witnessSet.set_vkeys(vkeys)

    const signedTx = C.Transaction.new(txBody, witnessSet)
    const submitRes = await fetch(`${hcfg.bfBase}/tx/submit`, {
      method: 'POST',
      headers: { project_id: hcfg.bfKey, 'Content-Type': 'application/cbor' },
      body: Buffer.from(signedTx.to_bytes())
    })
    if (!submitRes.ok) {
      const errText = await submitRes.text()
      return { ok: false, hotVaultAddress: hotBech32, error: `Blockfrost submit lỗi: ${errText}` }
    }
    const txHash = String(await submitRes.json())
    console.log(`[mc-delivery] Đã gửi thật ${mcAmount.toLocaleString()} MC -> ${buyerAddress} (ref=${refId}, tx=${txHash})`)
    return { ok: true, txHash, hotVaultAddress: hotBech32 }
  } catch (e: any) {
    console.error(`[mc-delivery] Lỗi giao ${mcAmount} MC (ref=${refId}):`, e?.message || e)
    return { ok: false, error: e?.message || String(e) }
  }
}

/**
 * Đưa lệnh giao MC Native Asset thật vào hàng đợi tuần tự (chống xung đột UTxO ví nóng).
 */
export function deliverMcNativeAsset(buyerAddress: string, mcAmount: number, refId: string): Promise<McDeliveryResult> {
  const next = deliveryChain.then(() => executeDelivery(buyerAddress, mcAmount, refId))
  deliveryChain = next.catch(() => {})
  return next
}
