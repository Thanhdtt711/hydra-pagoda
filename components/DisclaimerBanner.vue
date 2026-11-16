<script setup lang="ts">
import UiModal from '~/components/ui/UiModal.vue'
import UiButton from '~/components/ui/UiButton.vue'
import { t, tr } from '~/lib/ui/copy'

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <UiModal
    :title="t('title.legal')"
    :subtitle="tr('Mô phỏng văn hóa, không tiên tri', 'Cultural simulation, not prophecy')"
    @close="emit('close')"
  >
    <details class="text-sm text-secondary space-y-3 bg-surface-elevated p-4 rounded-lg border border-hairline leading-relaxed"><summary class="cursor-pointer text-primary font-semibold">{{ t('btn.more') }}</summary>
      <div class="flex items-start gap-3">
        <span class="font-numbers text-xs font-bold text-primary mt-0.5">01.</span>
        <p class="m-0">
          <strong class="text-primary">{{ tr('Mô phỏng văn hóa viễn tưởng:', 'Fictional cultural simulation:') }}</strong> {{ tr('Toàn bộ các hoạt động rút quẻ xăm, tình duyên, dâng sao cầu an là nội dung mô phỏng văn hóa dân gian hư cấu nhằm mục đích lưu giữ di sản văn hóa phi vật thể.', 'All fortune-stick drawing, matchmaking, and star-offering activities are fictional folk-culture simulations created to preserve intangible cultural heritage.') }}
        </p>
      </div>
      <div class="flex items-start gap-3">
        <span class="font-numbers text-xs font-bold text-primary mt-0.5">02.</span>
        <p class="m-0">
          <strong class="text-primary">{{ tr('Không tiên tri số mệnh:', 'No real-world prophecy:') }}</strong> {{ tr('Trò chơi hoàn toàn không có giá trị bói toán hay thay đổi vận mệnh đời thực. Thuật toán chọn quẻ là hàm ngẫu nhiên giả lập theo ngày.', 'This experience has no real-life divination or fate-altering value. Readings are generated deterministically using daily pseudo-random seeds.') }}
        </p>
      </div>
      <div class="flex items-start gap-3">
        <span class="font-numbers text-xs font-bold text-primary mt-0.5">03.</span>
        <p class="m-0">
          <strong class="text-primary">{{ tr('Chánh niệm & Trách nhiệm:', 'Mindfulness & Responsibility:') }}</strong> {{ tr('Hãy tiếp cận với tinh thần hoan hỷ, an lạc. Mọi quyết định trong đời sống cần xây dựng trên nền tảng khoa học, lý trí và đạo đức.', 'Please enjoy with a peaceful and joyful mind. Real-life decisions should always be grounded in science, reason, and ethics.') }}
        </p>
      </div>
    </details>

    <template #footer>
      <UiButton 
        variant="primary"
        size="md"
        block
        @click="emit('close')"
      >
        {{ t('btn.understood') }}
      </UiButton>
    </template>
  </UiModal>
</template>
