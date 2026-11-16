/**
 * Thả hoa đăng: tiêu 1 "Hoa Đăng Cầu An" (`lotus_lantern`) trong túi đồ, không tốn MC.
 * - Trừ vật phẩm nguyên tử bằng một câu UPDATE có điều kiện `quantity >= 1`, nên hai lần bấm đồng thời
 *   không thể thả quá số đèn đang có.
 * - Không thưởng MC, không đổi sổ cái; chỉ là hành động tâm linh có hiệu ứng trên hồ.
 */
import { apiError } from './auth'
import { getDb } from './db'
import { getAccountInventory } from './mcService'

export const LANTERN_ITEM_ID = 'lotus_lantern'

export async function releaseLantern(accountId: number, now = Date.now()) {
  const conn = await getDb()
  // Bảng account_inventory có CHECK (quantity >= 1): nếu quantity > 1 thì trừ 1, nếu quantity = 1 thì xóa dòng.
  const upd = await conn
    .prepare(
      `UPDATE account_inventory
          SET quantity = quantity - 1, updated_at = ?
        WHERE account_id = ? AND item_id = ? AND quantity > 1`
    )
    .run(now, accountId, LANTERN_ITEM_ID)

  if (Number(upd.changes || 0) === 0) {
    const del = await conn
      .prepare(
        `DELETE FROM account_inventory
          WHERE account_id = ? AND item_id = ? AND quantity = 1`
      )
      .run(accountId, LANTERN_ITEM_ID)

    if (Number(del.changes || 0) === 0) {
      apiError(400, 'no_lantern', 'Bạn chưa có Hoa Đăng Cầu An. Hãy thỉnh ở Cửa Hàng.')
    }
  }

  const inventory = await getAccountInventory(accountId)
  const left = inventory.find(i => i.itemId === LANTERN_ITEM_ID)
  return { inventory, remaining: Number(left?.quantity ?? 0) }
}

