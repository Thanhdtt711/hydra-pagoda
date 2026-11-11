import { useWalletBridgeClient, type UseWalletBridgeClientReturn } from '@hydraone-sdk/core/vue'

let sharedBridgeInstance: (UseWalletBridgeClientReturn & { isIframe: boolean }) | null = null

/**
 * Composable bọc quanh HydraOne Wallet Bridge (@hydraone-sdk/core).
 * Dùng chung một instance toàn app (singleton).
 * Tự động phát hiện môi trường iframe khi nhúng trong HydraOne Portal.
 */
export function useHydraOneWallet() {
  const isIframe = typeof window !== 'undefined' && window.parent !== window

  if (sharedBridgeInstance) {
    return sharedBridgeInstance
  }

  const config = useRuntimeConfig()
  const rawOrigin = String(config.public.appCenterOrigin || config.public.APP_CENTER_ORIGIN || '*')
  const origins = rawOrigin
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
  const hostOrigin = origins.length > 1 ? origins : (origins[0] || '*')

  // Khởi tạo bridge client; nếu ở iframe thì autoConnect: true
  const bridge = useWalletBridgeClient({
    hostOrigin,
    autoConnect: isIframe,
    autoRefreshBalance: false
  })

  sharedBridgeInstance = {
    ...bridge,
    isIframe
  }

  return sharedBridgeInstance
}

