<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useStreakStore, type StreakOutcome } from '~/stores/streak'
import { useDeedsStore } from '~/stores/deeds'
import { useEconomyStore } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import UiButton from '~/components/ui/UiButton.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import { t } from '~/lib/ui/copy'

const emit = defineEmits<{ (e: 'guideToDeed', landmark: string): void }>()

const streak = useStreakStore()
const deeds = useDeedsStore()
const economy = useEconomyStore()
const wallet = useWalletStore()

const status = computed(() => streak.status)

const DEED_LABELS: Array<{ key: 'meditation' | 'incense' | 'fortune' | 'merit'; label: string }> = [
  { key: 'meditation', label: 'Ngồi thiền trọn một thời' },
  { key: 'incense', label: 'Thắp hương đầu ngày' },
  { key: 'fortune', label: 'Gieo một quẻ cầu an' },
  { key: 'merit', label: 'Cúng dường Hòm Công Đức' }
]

const introLine = computed(() => {
  if (!wallet.isConnected) return t('desc.streakNeedWallet')
  if (status.value?.todayDone) return t('desc.streakDone')
  if (status.value?.canClaim) return t('desc.streakReady')
  return t('desc.streakNoDeed')
})

const restLine = computed(() => (status.value?.restUsedThisWeek ? t('desc.streakRestUsed') : t('desc.streakRest')))

const OUTCOME_NOTE: Record<StreakOutcome, string> = {
  first: 'Dấu đầu tiên đã vào sổ.',
  continued: 'Chuỗi nối tiếp.',
  rested: 'Ngày nghỉ đã giữ chuỗi cho bạn.',
  halved: 'Chuỗi về nửa, bạn vẫn đang đi tiếp.',
  already: 'Hôm nay đã ghi dấu rồi.'
}

const outcomeNote = computed(() => (streak.lastOutcome ? OUTCOME_NOTE[streak.lastOutcome] : ''))

function rewardLine(r: { label: string; cardTitle?: string; alreadyOwned?: boolean }): string {
  if (r.cardTitle) return `Thẻ di sản: ${r.cardTitle}`
  if (r.alreadyOwned) return `${r.label} (bạn đã có sẵn)`
  return r.label
}

async function onClaim() {
  const res = await streak.claim()
  if (res && res.rewards.length > 0) void economy.loadCatalog()
}

const deedsStatus = computed(() => deeds.status)

async function onClaimDeeds() {
  const res = await deeds.claim()
  if (res?.granted) void economy.loadCatalog()
}

onMounted(() => {
  void streak.refreshStatus()
  void deeds.refreshStatus()
})

defineExpose({ refresh: () => streak.refreshStatus() })
</script>

<template>
  <div class="max-w-lg mx-auto space-y-4">
    <div class="rounded-lg border border-hairline bg-surface-card p-5 space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-base font-bold text-white">{{ t('title.streak') }}</h3>
          <p class="text-xs text-secondary leading-relaxed mt-1">{{ t('desc.streakIntro') }}</p>
        </div>
        <UiBadge v-if="status?.title" variant="gold">{{ status.title }}</UiBadge>
      </div>

      <div class="grid grid-cols-2 gap-2 text-left">
        <div class="rounded-lg border border-hairline bg-surface-elevated p-2.5">
          <div class="text-xs text-secondary font-medium">Chuỗi hiện tại</div>
          <div class="text-sm font-numbers font-bold text-primary mt-0.5">{{ status?.currentStreak ?? 0 }} ngày</div>
        </div>
        <div class="rounded-lg border border-hairline bg-surface-elevated p-2.5">
          <div class="text-xs text-secondary font-medium">Dài nhất</div>
          <div class="text-sm font-numbers font-bold text-white mt-0.5">{{ status?.bestStreak ?? 0 }} ngày</div>
        </div>
      </div>

      <div
        v-if="status?.nextMilestone"
        class="rounded-lg border border-hairline bg-surface-elevated p-3 text-left text-xs text-secondary leading-relaxed"
      >
        Còn
        <span class="font-numbers font-bold text-white">{{ status.nextMilestone.milestone - status.currentStreak }}</span>
        ngày tới cột mốc
        <span class="font-numbers font-bold text-primary">{{ status.nextMilestone.milestone }}</span>:
        {{ status.nextMilestone.label }}
      </div>
      <p v-else-if="status" class="text-xs text-secondary text-left">{{ t('desc.streakAllDone') }}</p>

      <div class="space-y-2 text-left">
        <h4 class="text-sm font-bold text-white">{{ t('title.streakDeeds') }}</h4>
        <ul class="space-y-1.5">
          <li v-for="d in DEED_LABELS" :key="d.key" class="flex items-center gap-2 text-xs">
            <ZenIcon
              :name="status?.deeds[d.key] ? 'circle-check' : 'moon'"
              :size="16"
              class="shrink-0"
              :class="status?.deeds[d.key] ? 'text-primary' : 'text-secondary'"
            />
            <span :class="status?.deeds[d.key] ? 'text-white' : 'text-secondary'">{{ d.label }}</span>
          </li>
        </ul>
      </div>

      <p class="text-xs text-secondary text-left leading-relaxed">{{ introLine }}</p>

      <UiButton
        v-if="!wallet.isConnected"
        variant="secondary"
        size="md"
        block
        @click="economy.openTopUpModal()"
      >
        {{ t('btn.streakConnect') }}
      </UiButton>
      <UiButton
        v-else
        variant="primary"
        size="md"
        block
        :loading="streak.claiming"
        :disabled="!status?.canClaim"
        @click="onClaim"
      >
        {{ status?.todayDone ? 'Đã ghi dấu' : t('btn.streakMark') }}
      </UiButton>

      <p v-if="streak.error" class="text-xs text-down text-left">{{ streak.error }}</p>

      <div
        v-if="outcomeNote || streak.lastRewards.length"
        class="rounded-lg border border-hairline bg-surface-elevated p-3 text-left space-y-1.5"
      >
        <p v-if="outcomeNote" class="text-xs text-body">{{ outcomeNote }}</p>
        <p v-for="r in streak.lastRewards" :key="r.milestone" class="text-xs font-semibold text-primary">
          Cột mốc {{ r.milestone }} ngày: {{ rewardLine(r) }}
        </p>
      </div>

      <p class="text-xs text-secondary text-left leading-relaxed">{{ restLine }} {{ t('desc.streakHalve') }}</p>
    </div>

    <div class="rounded-lg border border-hairline bg-surface-card p-5 space-y-3 text-left">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h4 class="text-sm font-bold text-white">{{ t('title.deeds') }}</h4>
          <p class="text-xs text-secondary leading-relaxed mt-1">{{ t('desc.deedsIntro') }}</p>
        </div>
        <span class="text-sm font-numbers font-bold text-primary shrink-0">{{ deedsStatus?.doneCount ?? 0 }}/{{ deedsStatus?.total ?? 3 }}</span>
      </div>

      <p v-if="!wallet.isConnected" class="text-xs text-secondary leading-relaxed">{{ t('desc.deedsNeedWallet') }}</p>
      <template v-else>
        <ul class="space-y-2">
          <li v-for="d in deedsStatus?.deeds ?? []" :key="d.id" class="flex items-center gap-2 text-xs">
            <ZenIcon
              :name="d.done ? 'circle-check' : 'moon'"
              :size="16"
              class="shrink-0"
              :class="d.done ? 'text-primary' : 'text-secondary'"
            />
            <span class="min-w-0 flex-1" :class="d.done ? 'text-white' : 'text-secondary'">{{ d.label }}</span>
            <UiButton
              v-if="d.kind === 'visit' && d.landmark && !d.done"
              variant="secondary"
              size="sm"
              @click="emit('guideToDeed', d.landmark)"
            >
              {{ t('btn.deedGo') }}
            </UiButton>
          </li>
        </ul>

        <p v-if="deedsStatus?.deeds.some(d => d.kind === 'visit' && !d.done)" class="text-xs text-secondary leading-relaxed">
          {{ t('desc.deedsRoute') }}
        </p>

        <p v-if="deedsStatus?.rewardClaimed" class="text-xs text-secondary leading-relaxed">{{ t('desc.deedsDone') }}</p>
        <p v-else-if="deedsStatus?.canClaim" class="text-xs text-primary leading-relaxed">{{ t('desc.deedsReady') }}</p>

        <div v-if="!deedsStatus?.rewardClaimed" class="text-xs text-secondary">
          Quà: <span class="text-white font-semibold">{{ deedsStatus?.reward.label }}</span>
        </div>

        <UiButton
          variant="secondary"
          size="md"
          block
          :loading="deeds.claiming"
          :disabled="!deedsStatus?.canClaim"
          @click="onClaimDeeds"
        >
          {{ deedsStatus?.rewardClaimed ? 'Đã nhận quà' : t('btn.deedClaim') }}
        </UiButton>

        <p v-if="deeds.error" class="text-xs text-down">{{ deeds.error }}</p>
        <p v-if="deeds.lastReward" class="text-xs font-semibold text-primary">Đã nhận: {{ deeds.lastReward.label }}</p>
      </template>
    </div>

    <div class="rounded-lg border border-hairline bg-surface-card p-5 space-y-2.5 text-left">
      <h4 class="text-sm font-bold text-white">{{ t('title.streakMilestones') }}</h4>
      <ul class="space-y-1.5">
        <li v-for="m in status?.milestones ?? []" :key="m.milestone" class="flex items-start gap-2 text-xs">
          <ZenIcon
            :name="m.granted ? 'circle-check' : m.reached ? 'sparkles' : 'moon'"
            :size="16"
            class="shrink-0 mt-px"
            :class="m.granted || m.reached ? 'text-primary' : 'text-secondary'"
          />
          <span class="font-numbers font-bold w-10 shrink-0" :class="m.reached ? 'text-white' : 'text-secondary'">{{ m.milestone }}</span>
          <span :class="m.reached ? 'text-white' : 'text-secondary'">{{ m.label }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
