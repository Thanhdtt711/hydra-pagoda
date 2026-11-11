<script setup lang="ts">
import { onMounted } from 'vue'
import { useWalletStore } from '~/stores/wallet'
import { useHydraOneWallet } from '~/composables/useHydraOneWallet'

const wallet = useWalletStore()

onMounted(async () => {
  if (typeof window !== 'undefined' && window.parent !== window) {
    try {
      const bridge = useHydraOneWallet()
      await bridge.init()
    } catch (err) {
      console.debug('[App] HydraOne Bridge init:', err)
    }
  }
  await wallet.restore()
})
</script>

<template>
  <div>
    <NuxtPage />
  </div>
</template>
