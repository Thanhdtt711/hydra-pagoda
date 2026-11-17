<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiButton from '~/components/ui/UiButton.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import { zenAudio } from '~/lib/audio/ZenAudio'
import { tr } from '~/lib/ui/copy'
import { useEconomyStore } from '~/stores/economy'
import { useMeditationStore } from '~/stores/meditation'
import { useWalletStore } from '~/stores/wallet'

const meditation = useMeditationStore()
const economy = useEconomyStore()
const wallet = useWalletStore()

const activePilgrimCount = ref(0)
const groupResonanceActive = ref(false)
const groupBonusMc = ref(15)
const groupBonusClaimedToday = ref(false)
const claiming = ref(false)
const notice = ref<string | null>(null)

let timer: ReturnType<typeof setInterval> | null = null

async function refreshGroupStatus() {
  try {
    const res = await $fetch<{
      activePilgrimCount?: number
      groupResonanceActive?: boolean
      groupBonusMc?: number
      groupBonusClaimedToday?: boolean
    }>('/api/mc/meditation/status')
    activePilgrimCount.value = Number(res.activePilgrimCount ?? 0)
    groupResonanceActive.value = Boolean(res.groupResonanceActive)
    groupBonusMc.value = Number(res.groupBonusMc ?? 15)
    groupBonusClaimedToday.value = Boolean(res.groupBonusClaimedToday)
  } catch {
    // Bỏ qua lỗi mạng tạm thời
  }
}

async function claimBonus() {
  if (claiming.value) return
  claiming.value = true
  notice.value = null
  try {
    const res = await $fetch<{
      ok: boolean
      creditedMc: number
      mcBalance: number
      dailyEarnedMc: number
    }>('/api/mc/meditation/group-bonus', { method: 'POST' })
    if (res?.ok) {
      groupBonusClaimedToday.value = true
      economy.syncBalanceFromServer(res.mcBalance)
      economy.meditation.dailyEarnedMc = res.dailyEarnedMc
      zenAudio.playSingingBowl()
      notice.value = tr(`Đã nhận +${res.creditedMc} MC Lộc Cộng Hưởng!`, `Claimed +${res.creditedMc} MC Group Bonus!`)
    }
  } catch (e: any) {
    notice.value = e?.data?.data?.message || e?.data?.message || e?.message || tr('Chưa đủ điều kiện nhận lộc.', 'Not eligible yet.')
  } finally {
    claiming.value = false
  }
}

watch(
  () => meditation.isSeated,
  () => {
    void refreshGroupStatus()
  }
)

onMounted(() => {
  void refreshGroupStatus()
  timer = setInterval(() => {
    void refreshGroupStatus()
  }, 6000)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<template>
  <div class="rounded-lg border border-hairline bg-surface-card p-5 space-y-3 text-left">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <ZenIcon name="users" :size="18" class="text-primary shrink-0" />
          <h4 class="text-sm font-bold text-white truncate">{{ tr('Hội Thiền Nhóm', 'Group Meditation') }}</h4>
        </div>
        <p class="text-xs text-secondary leading-relaxed mt-1">
          {{ tr('Từ 2 đồng tu cùng ngồi thiền sẽ mở chuông cộng hưởng.', '2+ pilgrims meditating together unlock group resonance.') }}
        </p>
      </div>
      <UiBadge :variant="groupResonanceActive ? 'gold' : 'neutral'">
        <span class="font-numbers">{{ activePilgrimCount }}/2</span> {{ tr('đồng tu', 'pilgrims') }}
      </UiBadge>
    </div>

    <div class="flex items-center justify-between gap-2 rounded-[2px] border border-hairline bg-surface-elevated px-3 py-2 text-xs">
      <span class="text-secondary">{{ tr('Lộc cộng hưởng mỗi ngày:', 'Daily resonance bonus:') }}</span>
      <span class="font-numbers font-bold text-primary">+{{ groupBonusMc }} MC</span>
    </div>

    <UiButton
      v-if="wallet.isConnected"
      variant="secondary-light"
      size="sm"
      block
      :loading="claiming"
      :disabled="!meditation.isSeated || !groupResonanceActive || groupBonusClaimedToday"
      @click="claimBonus"
    >
      {{ groupBonusClaimedToday ? tr('Đã nhận lộc', 'Claimed Today') : tr('Nhận lộc nhóm', 'Claim Bonus') }}
    </UiButton>
    <p v-else class="text-xs text-secondary">
      {{ tr('Kết nối ví để nhận thưởng Hội Thiền Nhóm.', 'Connect wallet to claim Group Meditation bonus.') }}
    </p>

    <p v-if="notice" class="text-xs text-primary">{{ notice }}</p>
  </div>
</template>

