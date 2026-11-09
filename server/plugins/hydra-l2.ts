import { getHydraConfig } from '../utils/hydra/config'
import { getHydraClient, stopHydraClient } from '../utils/hydra/hydraClient'

/**
 * Nitro plugin: khi HYDRA_L2_ENABLED=true thì mở kết nối bền vững tới hydra-node (tự reconnect).
 * Mặc định tắt => không tạo kết nối nào, hành vi hệ thống y hệt phiên bản SQLite thuần.
 */
export default defineNitroPlugin((nitroApp) => {
    const cfg = getHydraConfig()
    if (!cfg.enabled) return
    console.log(`[hydra:l2] Chế độ Hybrid BẬT -> hydra-node ${cfg.wsUrl}`)
    try {
        getHydraClient()
    } catch (e: any) {
        console.warn('[hydra:l2] Không khởi động được client (fallback SQLite):', e?.message || e)
    }
    nitroApp.hooks.hook('close', () => {
        stopHydraClient()
    })
})
