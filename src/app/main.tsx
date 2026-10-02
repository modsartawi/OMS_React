import { StrictMode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import '@/core/theme/proto-362' // PROTOTYPE 362: palette attribute + stub, before anything paints
import '@/layout/__prototype__/proto-363' // PROTOTYPE 363: shell variant + dir=rtl, before anything paints
import '@/core/i18n'
import '@/app/global.css'
import { router } from '@/app/router'
import { ConfirmHost } from '@/core/services/confirm'
import { useTheme } from '@/layout/theme'
import OverlayBar from '@/layout/__prototype__/OverlayBar' // PROTOTYPE 377
import { useP377 } from '@/layout/__prototype__/proto-377' // PROTOTYPE 377

/** PROTOTYPE 377: the last open native <dialog>, so the Toaster can follow it into the top layer. */
function useTopDialog(): HTMLDialogElement | null {
  const [el, setEl] = useState<HTMLDialogElement | null>(null)
  useEffect(() => {
    const read = () => {
      const all = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
      setEl(all.length ? all[all.length - 1] : null)
    }
    const mo = new MutationObserver(read)
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    read()
    return () => mo.disconnect()
  }, [])
  return el
}

/** Sonner doesn't watch the `.dark` class — feed it the app's theme store. */
function ThemedToaster() {
  const dark = useTheme((s) => s.dark)
  // PROTOTYPE 377: position / offset / host from the dev bar
  const o = useP377()
  const top = useTopDialog()
  const rtl = document.documentElement.dir === 'rtl'
  const end = rtl ? 'left' : 'right'
  const position =
    o.pos === 'top-right' ? 'top-right' : o.pos === 'top-end' ? (`top-${end}` as const) : o.pos === 'bottom-end' ? (`bottom-${end}` as const) : 'bottom-center'
  const offset = o.pos === 'top-end' ? { top: 52, left: 16, right: 16 } : o.pos === 'top-right' ? undefined : { bottom: 16, left: 16, right: 16 }
  const el = (
    <Toaster
      position={position}
      offset={offset}
      richColors={o.toast === 'today' || o.toast === 'tinted'}
      closeButton
      duration={6000}
      theme={dark ? 'dark' : 'light'}
    />
  )
  return o.host === 'dialog' && top ? createPortal(el, top) : el
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ThemedToaster />
      {/* One app-wide confirm dialog — what lets `confirmAction()` be awaited
          from anywhere without a component in scope. */}
      <ConfirmHost />
      <OverlayBar />
    </QueryClientProvider>
  </StrictMode>,
)
