import { useWalletBridgeClient, type UseWalletBridgeClientReturn } from '@hydraone-sdk/core/vue'

let sharedBridgeInstance: (UseWalletBridgeClientReturn & { isIframe: boolean }) | null = null

const DEFAULT_ORIGINS = [
  'https://beta.hydraone.app',
  'https://developers-portal-beta.hydraone.app',
  'https://dev.hydraone.app',
  'https://portal.hydraone.app',
  'https://alpha.hydraone.app',
  'https://hydraone.app'
]

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
  const rawOrigin = String(config.public.appCenterOrigin || config.public.APP_CENTER_ORIGIN || '')
  let origins = rawOrigin
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)

  if (import.meta.dev) {
    if (origins.length === 0) origins = ['*']
  } else {
    // Trong production tuyệt đối không dùng wildcard '*' để tránh HydraSecurityError
    origins = origins.filter(o => o !== '*')
    if (origins.length === 0) {
      origins = DEFAULT_ORIGINS
    }
  }

  const hostOrigin = origins.length > 1 ? origins : (origins[0] || DEFAULT_ORIGINS[0])

  // Khởi tạo bridge client; autoConnect: true khi ở iframe
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
