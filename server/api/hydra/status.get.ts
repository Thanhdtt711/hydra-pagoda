import { getHydraConfig } from '../../utils/hydra/config'
import { getHydraClient } from '../../utils/hydra/hydraClient'
import { getHydraStats } from '../../utils/hydra/hydraQueue'
import { deriveFuelKey } from '../../utils/hydra/l2TxBuilder'
import { getHydraSecret } from '../../utils/hydra/sessionKey'
import { getWalletConfig } from '../../utils/wallet/config'

/**
 * GET /api/hydra/status
 * Trạng thái lớp Hydra L2 & động cơ CSDL (PostgreSQL / SQLite) để hiển thị trên HUD/Ví.
 * Không yêu cầu đăng nhập, không lộ khóa hay URL nội bộ.
 */
export default defineEventHandler(async (event) => {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    const cfg = getHydraConfig()
    const dbEngine: 'postgres' | 'sqlite' = getWalletConfig().databaseUrl ? 'postgres' : 'sqlite'
    if (!cfg.enabled) {
        return {
            enabled: false,
            connected: false,
            mode: 'local_ledger',
            dbEngine,
            headStatus: 'Disconnected',
            latestSnapshotNo: 0,
            totalL2Txs: 0,
            confirmedL2Txs: 0,
            avgConfirmMs: null,
            ledger: null
        }
    }
    const client = getHydraClient()
    const s = client?.getStatus()
    let ledger: Awaited<ReturnType<typeof getHydraStats>> | null = null
    try { ledger = await getHydraStats() } catch { /* bỏ qua */ }
    // Địa chỉ Fuel (công khai) – cần có UTxO ở địa chỉ này trong Head thì L2 mới ghi được.
    let fuelAddress: string | null = null
    try { fuelAddress = deriveFuelKey(await getHydraSecret()).bech32 } catch { /* bỏ qua */ }
    return {
        enabled: true,
        connected: !!s?.connected,
        mode: client?.isOpen() ? 'hydra_l2' : 'local_ledger',
        dbEngine,
        headStatus: s?.headStatus ?? 'Disconnected',
        latestSnapshotNo: s?.latestSnapshotNo ?? 0,
        totalL2Txs: s?.totalL2Txs ?? 0,
        confirmedL2Txs: s?.confirmedL2Txs ?? 0,
        avgConfirmMs: s?.avgConfirmMs ?? null,
        fuelAddress,
        ledger
    }
})
