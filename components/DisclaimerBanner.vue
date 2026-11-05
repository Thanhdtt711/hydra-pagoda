<script setup lang="ts">
const emit = defineEmits(['close'])
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
    <div class="max-w-lg w-full p-6 bg-[#181a20] border border-[#2b3139] rounded-[10px] shadow-2xl relative text-left">
      <!-- Top Monospace Eyebrow -->
      <div class="flex items-center justify-between mb-3 border-b border-[#2b3139] pb-3">
        <span class="mono-eyebrow text-[#707a8a] text-[10px]">GOVERNANCE // COMPLIANCE & LEGAL NOTICE</span>
        <span class="font-mono text-[10px] text-[#FCD535] font-semibold">CODE: CIV-2026</span>
      </div>

      <h3 class="text-base font-bold text-white tracking-tight font-display mb-2">
        Quy Chuẩn Trải Nghiệm & Chống Mê Tín Dị Đoan
      </h3>
      
      <div class="text-xs text-[#929aa5] space-y-2.5 bg-[#1e2329] p-4 rounded-[6px] border border-[#2b3139] my-4 leading-relaxed font-sans">
        <div class="flex gap-2.5">
          <span class="font-mono text-[11px] text-[#FCD535] font-bold">01.</span>
          <p>
            <strong class="text-white">Mô phỏng Văn hóa Viễn tưởng:</strong> Toàn bộ các hoạt động rút quẻ xăm, tình duyên, dâng sao cầu an là <em>nội dung mô phỏng văn hóa dân gian hư cấu</em> nhằm mục đích lưu giữ di sản văn hóa phi vật thể.
          </p>
        </div>
        <div class="flex gap-2.5">
          <span class="font-mono text-[11px] text-[#FCD535] font-bold">02.</span>
          <p>
            <strong class="text-white">Không Tiên Tri Số Mệnh:</strong> Trò chơi hoàn toàn <em>không có giá trị bói toán hay thay đổi vận mệnh đời thực</em>. Thuật toán chọn quẻ là hàm ngẫu nhiên giả lập (`PRNG`).
          </p>
        </div>
        <div class="flex gap-2.5">
          <span class="font-mono text-[11px] text-[#FCD535] font-bold">03.</span>
          <p>
            <strong class="text-white">Chính Niệm & Trách Nhiệm:</strong> Hãy tiếp cận với tinh thần hoan hỷ, an lạc. Mọi quyết định trong đời sống cần xây dựng trên nền tảng khoa học, lý trí và đạo đức.
          </p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 mt-5">
        <button 
          @click="emit('close')"
          class="bn-btn-primary w-full py-2.5 px-4 rounded-[6px] font-bold text-xs justify-center cursor-pointer shadow-lg"
        >
          Tôi Đã Hiểu & Bước Vào Không Gian Thiền Tự
        </button>
      </div>
    </div>
  </div>
</template>
