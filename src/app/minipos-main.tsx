import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/app/minipos-i18n'
import '@/app/global.css'
import { ConfirmHost } from '@/core/services/confirm'
import MiniPosPhonePage from '@/features/mini-pos/phone/MiniPosPhonePage'
import { storedLanguage } from '@/features/mini-pos/phone/language'

/**
 * The Mini POS phone app's entry (BackOffice spec 4063, oms 916): the second Vite entry, `minipos/index.html`, served
 * at `/minipos/`. It shares the API client, the tokens and the text conventions with OMS, and nothing else: no OMS
 * router, no OMS session. Installed from the browser through its manifest; its service worker (emitted by the build,
 * `tools/minipos-sw.mjs`) keeps the shell and the scanner library for a start with no connection.
 */

const language = storedLanguage()
document.documentElement.lang = language
void i18n.changeLanguage(language)

// `networkMode: 'always'`: with no connection a call fails at once and the phone says "no connection" (oms 917), rather
// than TanStack pausing it and sending it by itself, unseen, when the line comes back.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false, networkMode: 'always' },
    mutations: { retry: false, networkMode: 'always' },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MiniPosPhonePage />
      <ConfirmHost />
    </QueryClientProvider>
  </StrictMode>,
)

// Production only: in dev the shell is Vite's, and a worker would serve yesterday's build to the next reload.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/minipos/sw.js', { scope: '/minipos/' }).catch(() => {
      /* no worker: the app still runs, only not offline */
    })
  })
}
