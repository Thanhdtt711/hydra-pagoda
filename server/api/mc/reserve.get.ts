import { defineEventHandler } from 'h3'
import { requireSession } from '../../utils/wallet/auth'
import { getReserveProof } from '../../utils/mc/reserveService'

/** GET /api/mc/reserve — Bằng chứng dự trữ MC (L1 đối soát L2), cache 30 giây. */
export default defineEventHandler(async (event) => {
  await requireSession(event)
  return getReserveProof()
})
