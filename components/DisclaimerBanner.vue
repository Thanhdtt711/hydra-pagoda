<script setup lang="ts">
import UiModal from '~/components/ui/UiModal.vue'
import UiButton from '~/components/ui/UiButton.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <UiModal
    title="Quy chuẩn & Pháp lý"
    subtitle="Mô phỏng văn hóa viễn tưởng & Chống mê tín dị đoan"
    @close="emit('close')"
  >
    <div class="text-sm text-secondary space-y-3 bg-surface-elevated p-4 rounded-lg border border-hairline leading-relaxed">
      <div class="flex items-start gap-3">
        <span class="font-numbers text-xs font-bold text-primary mt-0.5">01.</span>
        <p class="m-0">
          <strong class="text-primary">Mô phỏng văn hóa viễn tưởng:</strong> Toàn bộ các hoạt động rút quẻ xăm, tình duyên, dâng sao cầu an là nội dung mô phỏng văn hóa dân gian hư cấu nhằm mục đích lưu giữ di sản văn hóa phi vật thể.
        </p>
      </div>
      <div class="flex items-start gap-3">
        <span class="font-numbers text-xs font-bold text-primary mt-0.5">02.</span>
        <p class="m-0">
          <strong class="text-primary">Không tiên tri số mệnh:</strong> Trò chơi hoàn toàn không có giá trị bói toán hay thay đổi vận mệnh đời thực. Thuật toán chọn quẻ là hàm ngẫu nhiên giả lập theo ngày.
        </p>
      </div>
      <div class="flex items-start gap-3">
        <span class="font-numbers text-xs font-bold text-primary mt-0.5">03.</span>
        <p class="m-0">
          <strong class="text-primary">Chánh niệm &amp; Trách nhiệm:</strong> Hãy tiếp cận với tinh thần hoan hỷ, an lạc. Mọi quyết định trong đời sống cần xây dựng trên nền tảng khoa học, lý trí và đạo đức.
        </p>
      </div>
    </div>

    <template #footer>
      <UiButton 
        variant="primary"
        size="md"
        block
        @click="emit('close')"
      >
        Tôi đã hiểu và tiếp tục chiêm bái
      </UiButton>
    </template>
  </UiModal>
</template>
