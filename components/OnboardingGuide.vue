<script setup lang="ts">
import { computed } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import { tr } from '~/lib/ui/copy'
import { useOnboardingStore } from '~/stores/onboarding'
import { useWalletStore } from '~/stores/wallet'

const onboarding = useOnboardingStore()
const wallet = useWalletStore()

const copy = computed(() => {
  switch (onboarding.step) {
    case 'welcome':
      return {
        title: tr('Chào mừng hành giả', 'Welcome, pilgrim'),
        body: tr('Thầy Trụ Trì mời bạn dạo một vòng ngắn quanh chùa.', 'The Abbot invites you on a short walk around the sanctuary.')
      }
    case 'move':
      return {
        title: tr('Di chuyển', 'Move around'),
        body: tr('Nhấn W A S D để bước đi, kéo chuột để nhìn.', 'Press W A S D to walk, drag the mouse to look.')
      }
    case 'menu':
      return {
        title: tr('Mở chức năng', 'Open menus'),
        body: tr('Nhấn phím 1, 2 hoặc 3 để mở các bảng chức năng.', 'Press 1, 2 or 3 to open the feature panels.')
      }
    case 'incense':
      return {
        title: tr('Dâng hương', 'Offer incense'),
        body: tr('Đến đỉnh hương ngoài sân và nhấn E hoặc chuột phải.', 'Go to the courtyard incense burner and press E or right-click.')
      }
    default:
      return {
        title: tr('Hoàn tất', 'All done'),
        body: onboarding.needWallet
          ? tr('Kết nối ví để nhận Hoa Đăng Cầu An chào mừng.', 'Connect your wallet to receive the welcome Peace Lantern.')
          : tr('Nhận một Hoa Đăng Cầu An và thả xuống hồ sen.', 'Claim a Peace Lantern and release it on the lotus pond.')
      }
  }
})

const isManualStep = computed(() => onboarding.step === 'welcome')
const isLastStep = computed(() => onboarding.step === 'done')

function onPrimary() {
  if (isManualStep.value) onboarding.next()
  else if (isLastStep.value) void onboarding.finish(wallet.isConnected)
}
</script>

<template>
  <aside
    v-if="onboarding.active"
    role="status"
    aria-live="polite"
    class="pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-24 z-30 w-[92%] max-w-md px-4 py-3 rounded-[2px] bg-surface-card border border-[#c9a24b] shadow-2xl space-y-2"
  >
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <ZenIcon name="lotus" :size="18" class="text-[#c9a24b] shrink-0" />
        <h3 class="text-sm font-bold text-white truncate">{{ copy.title }}</h3>
      </div>
      <span class="font-numbers text-xs text-secondary shrink-0">
        {{ onboarding.stepIndex + 1 }}/{{ onboarding.stepCount }}
      </span>
    </div>

    <p class="text-sm text-secondary leading-relaxed m-0">{{ copy.body }}</p>

    <div class="flex items-center justify-between gap-2 pt-1">
      <UiButton
        v-if="!isLastStep || !onboarding.needWallet"
        variant="ghost"
        size="sm"
        @click="onboarding.skip()"
      >
        {{ tr('Bỏ qua', 'Skip') }}
      </UiButton>
      <UiButton
        v-else
        variant="ghost"
        size="sm"
        @click="onboarding.closeWithoutReward()"
      >
        {{ tr('Để sau', 'Later') }}
      </UiButton>

      <UiButton
        v-if="isManualStep || isLastStep"
        variant="secondary-light"
        size="sm"
        :loading="onboarding.claiming"
        @click="onPrimary"
      >
        {{ isLastStep ? tr('Nhận quà', 'Claim gift') : tr('Tiếp tục', 'Continue') }}
      </UiButton>
    </div>
  </aside>
</template>

