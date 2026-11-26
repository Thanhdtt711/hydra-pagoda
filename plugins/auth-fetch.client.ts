/**
 * Plugin tự động đính kèm Bearer sessionToken vào mọi request API nội bộ (/api/*)
 * để đảm bảo hoạt động ổn định trong môi trường Third-Party Iframe (khi Cookie có thể bị trình duyệt chặn).
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return
  const originalFetch = globalThis.$fetch
  if (!originalFetch || typeof originalFetch.create !== 'function') return

  const customFetch = originalFetch.create({
    onRequest({ request, options }) {
      const url = typeof request === 'string' ? request : String(request)
      if (url.startsWith('/api/') || url.includes('/api/')) {
        try {
          const token = sessionStorage.getItem('pagoda_session_token')
          if (token) {
            const headers = new Headers(options.headers as HeadersInit | undefined)
            if (!headers.has('Authorization')) {
              headers.set('Authorization', `Bearer ${token}`)
            }
            options.headers = headers
          }
        } catch { /* bỏ qua nếu storage bị chặn */ }
      }
    },
    // Wallet Gate: API nội bộ trả 401 giữa chừng (hết phiên, ví bị đổi) => thu hồi phiên và quay về màn hình kết nối ví.
    onResponseError({ request, response }) {
      if (response.status !== 401) return
      const url = typeof request === 'string' ? request : String(request)
      if (!url.includes('/api/')) return
      // Các endpoint xác thực tự xử lý lỗi của chính nó; tránh vòng lặp đăng xuất.
      if (url.includes('/api/auth/')) return
      const code = (response._data as { data?: { code?: string } } | undefined)?.data?.code
      if (code && code !== 'wallet_required' && code !== 'unauthenticated') return
      void dropSessionOnce()
    }
  })

  let dropping = false
  async function dropSessionOnce() {
    if (dropping) return
    dropping = true
    try {
      const { useWalletStore } = await import('~/stores/wallet')
      const wallet = useWalletStore()
      if (wallet.isAuthenticated) await wallet.dropSession('session_lost')
    } catch { /* bỏ qua */ } finally {
      dropping = false
    }
  }

  try {
    Object.defineProperty(globalThis, '$fetch', {
      value: customFetch,
      writable: true,
      configurable: true
    })
  } catch {
    ;(globalThis as any).$fetch = customFetch
  }
})

