import { getSessionAccount } from '../../../utils/wallet/auth'
import { getParkourStatus } from '../../../utils/wallet/parkourService'

export default defineEventHandler(async event => {
  const acc = await getSessionAccount(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    ...(await getParkourStatus(acc ? acc.id : null))
  }
})

