import { getWalletConfig } from '../utils/wallet/config'
import { syncPendingOrdersFromChain } from '../utils/wallet/orders'
import { getDb } from '../utils/wallet/db'

/**
 * Nitro plugin chạy nền: định kỳ đồng bộ các đơn mua MC đang chờ xác nhận
 * và quét địa chỉ treasury qua Blockfrost / Koios.
 * - Khi có đơn đang chờ xác nhận: quét chuỗi mỗi 15 giây.
 * - Khi ở trạng thái rảnh (không có đơn chờ): giãn nhịp quét mỗi 90 giây để tiết kiệm rate limit API công khai.
 * Đảm bảo người chơi đóng trình duyệt ngay sau khi gửi giao dịch vẫn được cộng MC đầy đủ.
 */
export default defineNitroPlugin((nitroApp) => {
  const cfg = getWalletConfig()
  const providerName = cfg.blockfrostApiKey
    ? 'Blockfrost'
    : cfg.koiosApiToken
      ? 'Koios (auth)'
      : 'Koios (public)'

  console.log(
    `[wallet:watcher] Đang theo dõi địa chỉ treasury ${cfg.treasuryAddress} trên mạng ${cfg.network.toUpperCase()} ` +
    `qua ${providerName} (yêu cầu >= ${cfg.confirmationsRequired} xác nhận)`
  )

  let ticksWithoutPending = 0

  const timer = setInterval(async () => {
    try {
      const db = await getDb()
      const hasPending = Boolean(
        await db.prepare(
          `SELECT 1 FROM mc_orders WHERE status IN ('signing', 'submitted', 'confirming') LIMIT 1`
        ).get()
      )
      if (hasPending) {
        ticksWithoutPending = 0
        void syncPendingOrdersFromChain({ force: true })
      } else {
        ticksWithoutPending++
        // Chế độ nghỉ: mỗi 6 nhịp (90 giây) mới quét treasury một lần để đón nhận giao dịch chuyển trực tiếp
        if (ticksWithoutPending >= 6) {
          ticksWithoutPending = 0
          void syncPendingOrdersFromChain({ force: true })
        }
      }
    } catch {
      // Bỏ qua nếu DB chưa khởi tạo
    }
  }, 15_000)

  nitroApp.hooks.hook('close', () => {
    clearInterval(timer)
  })
})
