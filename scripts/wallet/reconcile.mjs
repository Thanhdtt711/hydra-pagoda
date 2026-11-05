#!/usr/bin/env node
/**
 * Script đối soát Sổ cái MC Coin & Giao dịch Cardano Treasury (Bước 5 - Vận hành & Bảo mật)
 *
 * Chức năng:
 *   1. Đối soát tổng lovelace (ADA) thực nhận trong `chain_deposits` với tổng MC đã phát hành
 *      trong `mc_ledger` (reason = 'ada_deposit') theo quy tắc 1 ADA = 1.000 MC (1 MC = 1.000 lovelace).
 *   2. Kiểm tra bất biến sổ cái cho từng tài khoản:
 *      `accounts.mc_balance === SUM(mc_ledger.delta_mc)` và `mc_balance >= 0`.
 *   3. Thống kê tổng MC đã tiêu theo từng dịch vụ (`shop_purchase`, `fortune_divination`, `merit_donation`).
 *   4. Liệt kê các giao dịch/đơn cần đối soát thủ công (`underpaid`, `expired_paid`, `unmatched`).
 *
 * Cách chạy:
 *   node scripts/wallet/reconcile.mjs
 *   NUXT_DB_PATH=./.data/pagoda.sqlite node scripts/wallet/reconcile.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const dbPath = path.resolve(process.cwd(), process.env.NUXT_DB_PATH || './.data/pagoda.sqlite')

console.log('========================================================================')
console.log('📊 ĐỐI SOÁT TREASURY ADA & SỔ CÁI MC COIN — VẠN CẢNH THIỀN TỰ')
console.log('========================================================================')
console.log(`• CSDL SQLite : ${dbPath}`)
console.log(`• Thời điểm   : ${new Date().toISOString()}`)

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Không tìm thấy file CSDL tại: ${dbPath}`)
  process.exit(1)
}

const db = new DatabaseSync(dbPath, { readOnly: true })
let hasDiscrepancy = false

try {
  // 1. Đối soát tổng ADA (lovelace) nhận ở Treasury vs Tổng MC phát hành
  const depositStats = db.prepare(`
    SELECT
      COUNT(*) AS tx_count,
      COALESCE(SUM(lovelace), 0) AS total_lovelace,
      COALESCE(SUM(mc_credited), 0) AS total_mc_from_deposits
    FROM chain_deposits
    WHERE status = 'credited'
  `).get()

  const ledgerDepositStats = db.prepare(`
    SELECT
      COUNT(*) AS entry_count,
      COALESCE(SUM(delta_mc), 0) AS total_mc_in_ledger
    FROM mc_ledger
    WHERE reason = 'deposit_ada'
  `).get()

  const totalLovelace = Number(depositStats.total_lovelace || 0)
  const expectedMcFromLovelace = Math.floor(totalLovelace / 1000)
  const totalMcDeposits = Number(depositStats.total_mc_from_deposits || 0)
  const totalMcLedgerIn = Number(ledgerDepositStats.total_mc_in_ledger || 0)

  console.log('\n------------------------------------------------------------------------')
  console.log('1) ĐỐI SOÁT NẠP ADA ON-CHAIN (TREASURY) ↔ PHÁT HÀNH MC COIN')
  console.log('------------------------------------------------------------------------')
  console.log(`• Số giao dịch đã cộng MC (credited) : ${depositStats.tx_count} tx`)
  console.log(`• Tổng lovelace thực nhận ở Treasury : ${totalLovelace.toLocaleString('en-US')} lovelace (${(totalLovelace / 1_000_000).toFixed(6)} ADA)`)
  console.log(`• MC quy đổi chuẩn (lovelace / 1000) : ${expectedMcFromLovelace.toLocaleString('en-US')} MC`)
  console.log(`• Tổng mc_credited (chain_deposits)  : ${totalMcDeposits.toLocaleString('en-US')} MC`)
  console.log(`• Tổng delta_mc nạp (mc_ledger)      : ${totalMcLedgerIn.toLocaleString('en-US')} MC (${ledgerDepositStats.entry_count} bút toán)`)

  if (expectedMcFromLovelace === totalMcDeposits && totalMcDeposits === totalMcLedgerIn) {
    console.log('✅ KHỚP TUYỆT ĐỐI: Tổng lovelace nhận tại Treasury khớp 100% với tổng MC đã phát.')
  } else {
    hasDiscrepancy = true
    console.error('❌ LỆCH ĐỐI SOÁT NẠP: Có sự chênh lệch giữa chain_deposits và mc_ledger!')
  }

  // 2. Thống kê biến động MC theo loại giao dịch (reason)
  const byReason = db.prepare(`
    SELECT
      reason,
      COUNT(*) AS count,
      COALESCE(SUM(delta_mc), 0) AS net_mc
    FROM mc_ledger
    GROUP BY reason
    ORDER BY reason ASC
  `).all()

  console.log('\n------------------------------------------------------------------------')
  console.log('2) THỐNG KÊ SỔ CÁI MC THEO LOẠI NGHIỆP VỤ (mc_ledger)')
  console.log('------------------------------------------------------------------------')
  if (byReason.length === 0) {
    console.log('• Chưa có bút toán nào trong mc_ledger.')
  } else {
    for (const r of byReason) {
      const sign = Number(r.net_mc) >= 0 ? '+' : ''
      console.log(`• ${String(r.reason).padEnd(22, ' ')} : ${String(r.count).padStart(4, ' ')} bút toán | ${sign}${Number(r.net_mc).toLocaleString('en-US')} MC`)
    }
  }

  // 3. Kiểm tra bất biến số dư từng tài khoản: accounts.mc_balance === SUM(mc_ledger.delta_mc)
  const accounts = db.prepare(`
    SELECT
      a.id,
      a.address,
      a.display_name,
      a.mc_balance,
      COALESCE(SUM(l.delta_mc), 0) AS ledger_sum,
      COALESCE(SUM(CASE WHEN l.delta_mc > 0 THEN l.delta_mc ELSE 0 END), 0) AS total_in,
      COALESCE(SUM(CASE WHEN l.delta_mc < 0 THEN -l.delta_mc ELSE 0 END), 0) AS total_out,
      COUNT(l.id) AS ledger_entries
    FROM accounts a
    LEFT JOIN mc_ledger l ON l.account_id = a.id
    GROUP BY a.id
    ORDER BY a.id ASC
  `).all()

  console.log('\n------------------------------------------------------------------------')
  console.log('3) ĐỐI SOÁT SỐ DƯ TỪNG TÀI KHOẢN (accounts.mc_balance vs mc_ledger)')
  console.log('------------------------------------------------------------------------')
  let accountMismatchCount = 0
  for (const acc of accounts) {
    const bal = Number(acc.mc_balance)
    const sum = Number(acc.ledger_sum)
    const ok = bal === sum && bal >= 0
    if (!ok) {
      accountMismatchCount++
      hasDiscrepancy = true
    }
    const netLabel = acc.address.startsWith('addr_test1') ? 'preprod' : 'mainnet'
    const shortAddr = `${acc.address.slice(0, 14)}...${acc.address.slice(-6)}`
    console.log(
      `${ok ? '✅' : '❌'} Account #${acc.id} [${netLabel}] ${shortAddr} | ` +
      `Nạp: +${Number(acc.total_in).toLocaleString('en-US')} MC | ` +
      `Tiêu: -${Number(acc.total_out).toLocaleString('en-US')} MC | ` +
      `Số dư: ${bal.toLocaleString('en-US')} MC (Sổ cái: ${sum.toLocaleString('en-US')} MC, ${acc.ledger_entries} bút toán)`
    )
  }

  if (accountMismatchCount === 0) {
    console.log(`✅ Tất cả ${accounts.length} tài khoản đều khớp tuyệt đối với sổ cái và không có số dư âm.`)
  } else {
    console.error(`❌ Phát hiện ${accountMismatchCount} tài khoản lệch số dư so với sổ cái!`)
  }

  // 4. Danh sách giao dịch / đơn cần đối soát thủ công (nếu có)
  const manualDeposits = db.prepare(`
    SELECT tx_hash, order_id, lovelace, status, note, created_at
    FROM chain_deposits
    WHERE status IN ('underpaid', 'expired_paid', 'unmatched')
    ORDER BY created_at DESC
  `).all()

  console.log('\n------------------------------------------------------------------------')
  console.log('4) DANH SÁCH GIAO DỊCH CẦN KIỂM TRA THỦ CÔNG (underpaid / expired_paid / unmatched)')
  console.log('------------------------------------------------------------------------')
  if (manualDeposits.length === 0) {
    console.log('• Không có giao dịch bất thường nào cần xử lý thủ công (0 bản ghi).')
  } else {
    for (const d of manualDeposits) {
      console.log(
        `⚠️  [${d.status.toUpperCase()}] tx=${d.tx_hash} | order=${d.order_id || 'N/A'} | ` +
        `nhận=${Number(d.lovelace).toLocaleString('en-US')} lovelace | ghi chú=${d.note || ''}`
      )
    }
  }

  console.log('\n========================================================================')
  if (hasDiscrepancy) {
    console.error('❌ KẾT LUẬN: PHÁT HIỆN SAI LỆCH SỔ CÁI — CẦN KIỂM TRA NGAY!')
    process.exitCode = 1
  } else {
    console.log('✅ KẾT LUẬN: HỆ THỐNG ĐỐI SOÁT AN TOÀN — MỌI BẤT BIẾN TÀI CHÍNH ĐỀU ĐẠT.')
  }
  console.log('========================================================================')
} finally {
  db.close()
}
