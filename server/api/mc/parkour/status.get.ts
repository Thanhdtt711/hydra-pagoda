import { getSessionAccount } from '../../../utils/wallet/auth'
import { getParkourStatus } from '../../../utils/wallet/parkourService'

export default defineEventHandler(event => {
  const acc = getSessionAccount(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    ...getParkourStatus(acc ? acc.id : null)
  }
})

