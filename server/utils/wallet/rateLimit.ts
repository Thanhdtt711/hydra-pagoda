import type { H3Event } from 'h3'
import { getWalletConfig } from './config'

/**
 * Giới hạn tần suất cửa sổ trượt, trong RAM theo (khóa, IP).
 * Đủ cho một tiến trình; nếu chạy nhiều instance cần chuyển sang Redis/DB.
 */
const buckets = new Map<string, number[]>()

/** IP khách. Chỉ tin X-Forwarded-For khi cấu hình `trustProxy` (tránh giả IP để né limit). */
export function clientIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: getWalletConfig().trustProxy }) || 'unknown'
}

/** Ném 429 nếu vượt `max` lần trong `windowMs`. */
export function rateLimit(event: H3Event, name: string, max: number, windowMs: number) {
  const key = `${name}:${clientIp(event)}`
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter(t => now - t < windowMs)
  if (hits.length >= max) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0]!)) / 1000)
    setResponseHeader(event, 'Retry-After', retryAfter)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', data: { code: 'rate_limited', retryAfter } })
  }
  hits.push(now)
  buckets.set(key, hits)
  // Dọn bucket cũ định kỳ để Map không phình mãi.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1]! > windowMs * 2) buckets.delete(k)
  }
}

