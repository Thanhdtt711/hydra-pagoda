/**
 * Hướng dẫn người mới (onboarding): quà chào mừng là 1 Hoa Đăng Cầu An, không cộng MC.
 * Idempotent: khóa chính theo tài khoản nên gọi lại chỉ trả `granted: false`.
 */
import { apiError } from './auth.ts'
import { getDb, withTransaction } from './db.ts'

export const ONBOARDING_REWARD = {
  itemId: 'lotus_lantern',
  category: 'offering' as const,
  label: 'Hoa Đăng Cầu An'
}

function assertAccountId(accountId: number): void {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    apiError(401, 'unauthorized', 'Tài khoản không hợp lệ')
  }
}

export async function getOnboardingStatus(accountId: number | null) {
  if (accountId == null) return { authenticated: false, rewardClaimed: false, reward: ONBOARDING_REWARD }
  assertAccountId(accountId)
  const conn = await getDb()
  const row = await conn.prepare('SELECT 1 AS ok FROM onboarding_rewards WHERE account_id = ?').get(accountId)
  return { authenticated: true, rewardClaimed: Boolean(row), reward: ONBOARDING_REWARD }
}

export async function completeOnboarding(accountId: number, now = Date.now()) {
  assertAccountId(accountId)
  return withTransaction(async (conn) => {
    const ins = await conn
      .prepare('INSERT INTO onboarding_rewards (account_id, item_id, claimed_at) VALUES (?, ?, ?) ON CONFLICT(account_id) DO NOTHING')
      .run(accountId, ONBOARDING_REWARD.itemId, now)
    if (Number(ins.changes) === 0) return { granted: false, reward: ONBOARDING_REWARD }

    await conn
      .prepare(
        `INSERT INTO account_inventory (account_id, item_id, category, quantity, unlocked_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(account_id, item_id) DO UPDATE SET
           quantity = account_inventory.quantity + 1,
           updated_at = excluded.updated_at`
      )
      .run(accountId, ONBOARDING_REWARD.itemId, ONBOARDING_REWARD.category, now, now)
    return { granted: true, reward: ONBOARDING_REWARD }
  })
}

