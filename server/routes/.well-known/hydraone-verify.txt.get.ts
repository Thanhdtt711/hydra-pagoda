export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return 'hydraone-verify=gB7S4_CU99_UyP_jINMW0NLmXENEiVdlv_d4KKfc5xQ\n'
})
