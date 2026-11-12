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
    }
  })

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

