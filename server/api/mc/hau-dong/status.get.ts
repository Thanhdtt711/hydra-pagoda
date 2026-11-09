import { getSessionAccount } from '../../../utils/wallet/auth'
import { getHauDongStatus } from '../../../utils/wallet/hauDongService'

export default defineEventHandler(event => {
  const acc = getSessionAccount(event)
  return getHauDongStatus(acc ? acc.id : null)
})

