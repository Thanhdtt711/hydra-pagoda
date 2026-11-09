<script setup lang="ts">
/**
 * Huy hiệu trạng thái sổ cái cho MỘT giao dịch MC.
 * - snapshot_confirmed / valid / submitted -> "Hydra L2" kèm Snapshot / Tx.
 * - offchain / Hydra tắt / chưa có bằng chứng -> "SQLite" (chỉ ghi ở sổ cái cục bộ).
 * Không render gì nếu không truyền `proof` (chưa có dữ liệu giao dịch).
 */
interface HydraProofLike {
  enabled?: boolean
  status?: 'offchain' | 'submitted' | 'valid' | 'snapshot_confirmed' | string | null
  txHash?: string | null
  snapshotNo?: number | null
}

const props = withDefaults(defineProps<{
  proof?: HydraProofLike | null
  /** Chỉ hiện nhãn ngắn (dùng trong danh sách lịch sử). */
  compact?: boolean
}>(), { proof: null, compact: false })

const shortTx = computed(() => {
  const h = props.proof?.txHash
  return h ? `${h.slice(0, 4)}…${h.slice(-4)}` : ''
})

const view = computed(() => {
  const p = props.proof
  if (!p) return null
  const onL2 = p.enabled !== false && (p.status === 'snapshot_confirmed' || p.status === 'valid' || p.status === 'submitted')
  if (!onL2) {
    return {
      variant: 'neutral' as const,
      short: 'SQLite',
      full: 'SQLite · Ghi ở sổ cái cục bộ',
      title: 'Giao dịch chỉ nằm ở sổ cái cục bộ SQLite, chưa được xác nhận trên Hydra L2.'
    }
  }
  if (p.status === 'snapshot_confirmed') {
    return {
      variant: 'success' as const,
      short: 'Hydra L2',
      full: `Hydra L2 · Snapshot #${p.snapshotNo ?? '?'}${shortTx.value ? ` · Tx ${shortTx.value}` : ''}`,
      title: `Đã xác nhận trên Hydra L2${p.txHash ? ` – Tx ${p.txHash}` : ''}`
    }
  }
  if (p.status === 'valid') {
    return {
      variant: 'success' as const,
      short: 'Hydra L2',
      full: `Hydra L2 · Đã xác thực${shortTx.value ? ` · Tx ${shortTx.value}` : ''}`,
      title: `Giao dịch hợp lệ trên Hydra L2${p.txHash ? ` – Tx ${p.txHash}` : ''}`
    }
  }
  return {
    variant: 'info' as const,
    short: 'Hydra L2…',
    full: `Hydra L2 · Đang xác nhận${shortTx.value ? ` · Tx ${shortTx.value}` : ''}`,
    title: `Đã gửi lên Hydra L2, đang chờ snapshot${p.txHash ? ` – Tx ${p.txHash}` : ''}`
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
