import { initDomTranslator } from '~/lib/ui/domTranslator'

export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    initDomTranslator()
  }
})

