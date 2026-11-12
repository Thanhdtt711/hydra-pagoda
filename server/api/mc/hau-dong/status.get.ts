import { getSessionAccount } from '../../../utils/wallet/auth'
import { getHauDongStatus } from '../../../utils/wallet/hauDongService'

export default defineEventHandler(async event => {
  const acc = await getSessionAccount(event)
  return getHauDongStatus(acc ? acc.id : null)
})

