import { getWalletConfig } from '../utils/wallet/config'
import { syncPendingOrdersFromChain } from '../utils/wallet/orders'

/**
 * Nitro plugin chạy nền: định kỳ mỗi 15 giây đồng bộ các đơn mua MC đang chờ xác nhận
 * và quét địa chỉ treasury qua Blockfrost (khi đã cấu hình BLOCKFROST_API_KEY).
 * Đảm bảo người chơi đóng trình duyệt ngay sau khi gửi giao dịch vẫn được cộng MC đầy đủ.
 */
export default defineNitroPlugin((nitroApp) => {
  const cfg = getWalletConfig()
  const providerName = cfg.blockfrostApiKey ? 'Blockfrost' : 'Koios (public)'

  console.log(
    `[wallet:watcher] Đang theo dõi địa chỉ treasury ${cfg.treasuryAddress} trên mạng ${cfg.network.toUpperCase()} ` +
    `qua ${providerName} (yêu cầu >= ${cfg.confirmationsRequired} xác nhận)`
  )

  const timer = setInterval(() => {
    void syncPendingOrdersFromChain()
  }, 15_000)

  nitroApp.hooks.hook('close', () => {
    clearInterval(timer)
  })
})

