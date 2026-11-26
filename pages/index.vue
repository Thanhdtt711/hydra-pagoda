<script setup lang="ts">
import { onMounted } from 'vue'
import { useWalletStore } from '~/stores/wallet'

/**
 * Chưa kết nối ví vẫn được đi lại tham quan thế giới 3D; toàn bộ số dư MC và các tính năng
 * (nhiệm vụ, mua sắm, bói quẻ, công đức, API) bị khóa chặt ở cả frontend lẫn backend cho đến khi ký ví.
 * Không gắn `:key` theo địa chỉ ví lên TempleCanvas để tránh tải lại màn hình 3D 0% -> 100% hai lần;
 * việc nạp/xóa dữ liệu theo phiên ví được TempleCanvas lắng nghe trực tiếp qua `wallet.isAuthenticated`.
 */
const wallet = useWalletStore()

onMounted(() => {
  void wallet.restore()
})
</script>

<template>
  <main class="w-screen h-screen overflow-hidden bg-[#100e0c]">
    <TempleCanvas />
  </main>
</template>
