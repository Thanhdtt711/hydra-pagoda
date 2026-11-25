<script setup lang="ts">
/**
 * Huy hiệu trạng thái sổ cái cho MỘT giao dịch MC.
 * - snapshot_confirmed / valid / submitted -> "Hydra L2" kèm Snapshot / Tx.
 * - offchain / Hydra tắt / chưa có bằng chứng -> "PostgreSQL" hoặc "SQLite" theo CSDL đang dùng.
 * Không render gì nếu không truyền `proof` (chưa có dữ liệu giao dịch).
 */
import { computed, onMounted } from 'vue'
import { useHydraStore } from '~/stores/hydra'
import { tr } from '~/lib/ui/copy'

interface HydraProofLike {
  enabled?: boolean
  status?: 'offchain' | 'submitted' | 'valid' | 'snapshot_confirmed' | string | null
  txHash?: string | null
  snapshotNo?: number | null
  dbEngine?: 'postgres' | 'sqlite' | string | null
}

const props = withDefaults(defineProps<{
  proof?: HydraProofLike | null
  /** Chỉ hiện nhãn ngắn (dùng trong danh sách lịch sử). */
  compact?: boolean
}>(), { proof: null, compact: false })

const hydra = useHydraStore()

onMounted(() => {
  if (!hydra.loaded) {
    hydra.startPolling()
  }
})

const shortTx = computed(() => {
  const h = props.proof?.txHash
  return h ? `${h.slice(0, 4)}…${h.slice(-4)}` : ''
})

const liveTx = computed(() => {
  const h = props.proof?.txHash
  if (!h) return null
  return hydra.status?.recentTxs?.find(t => t.txHash.toLowerCase() === h.toLowerCase()) ?? null
})

const effectiveStatus = computed(() => {
  const s = props.proof?.status
  const live = liveTx.value
  if (live?.status === 'snapshot_confirmed') return 'snapshot_confirmed'
  if (s === 'submitted' && live?.status === 'valid') return 'valid'
  return s
})

const effectiveSnapshotNo = computed(() => {
  return props.proof?.snapshotNo ?? liveTx.value?.snapshotNo ?? hydra.status?.latestSnapshotNo ?? null
})

const view = computed(() => {
  const p = props.proof
  if (!p) return null
  const st = effectiveStatus.value
  const onL2 = p.enabled !== false && (st === 'snapshot_confirmed' || st === 'valid' || st === 'submitted')
  if (!onL2) {
    const isPg = p.dbEngine ? p.dbEngine === 'postgres' : hydra.isPostgres
    const dbName = isPg ? 'PostgreSQL' : 'SQLite'
    return {
      variant: (isPg ? 'info' : 'neutral') as 'info' | 'neutral',
      short: dbName,
      full: isPg ? tr('PostgreSQL · Sổ cái Supabase', 'PostgreSQL · Supabase Ledger') : tr('SQLite · Sổ cái cục bộ', 'SQLite · Local Ledger'),
      title: isPg
        ? tr('Giao dịch được ghi nhận ở sổ cái PostgreSQL (Supabase), chưa được xác nhận trên Hydra L2.', 'Recorded on PostgreSQL (Supabase) ledger, not yet confirmed on Hydra L2.')
        : tr('Giao dịch chỉ nằm ở sổ cái cục bộ SQLite, chưa được xác nhận trên Hydra L2.', 'Recorded on local SQLite ledger, not yet confirmed on Hydra L2.')
    }
  }
  if (st === 'snapshot_confirmed') {
    return {
      variant: 'success' as const,
      short: 'Hydra L2',
      full: `Hydra L2 · Snapshot #${effectiveSnapshotNo.value ?? '?'}${shortTx.value ? ` · Tx ${shortTx.value}` : ''}`,
      title: tr(`Đã xác nhận trên Hydra L2${p.txHash ? ` – Tx ${p.txHash}` : ''}`, `Confirmed on Hydra L2${p.txHash ? ` – Tx ${p.txHash}` : ''}`)
    }
  }
  if (st === 'valid') {
    const snapText = effectiveSnapshotNo.value ? `Snapshot #${effectiveSnapshotNo.value}` : tr('Đã xác thực', 'Validated')
    return {
      variant: 'success' as const,
      short: 'Hydra L2',
      full: `Hydra L2 · ${snapText}${shortTx.value ? ` · Tx ${shortTx.value}` : ''}`,
      title: tr(`Giao dịch hợp lệ trên Hydra L2${p.txHash ? ` – Tx ${p.txHash}` : ''}`, `Valid transaction on Hydra L2${p.txHash ? ` – Tx ${p.txHash}` : ''}`)
    }
  }
  return {
    variant: 'info' as const,
    short: 'Hydra L2…',
    full: `Hydra L2 · ${tr('Đang xác nhận', 'Confirming')}${shortTx.value ? ` · Tx ${shortTx.value}` : ''}`,
    title: tr(`Đã gửi lên Hydra L2, đang chờ snapshot${p.txHash ? ` – Tx ${p.txHash}` : ''}`, `Submitted to Hydra L2, awaiting snapshot${p.txHash ? ` – Tx ${p.txHash}` : ''}`)
  }
})
</script>

<template>
  <UiBadge
    v-if="view"
    :variant="view.variant"
    dot
    :title="view.title"
    class="font-numbers"
    data-testid="hydra-badge"
  >{{ props.compact ? view.short : view.full }}</UiBadge>
</template>
