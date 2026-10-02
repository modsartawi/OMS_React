import { useSyncExternalStore } from 'react'
import { Toaster } from 'sonner'
import { documentDirection, toasterPositionFor } from '@/core/theme/direction'
import { useTheme } from './theme'

// The one Toaster, at the root (spec 380 F16/F18, ticket 388; 377 §2/§4). It never follows
// an open `<dialog>` into the top layer: moving the host drops the toasts already on
// screen, so a dialog's own failure renders inside the dialog instead (390).
//
// Its look is `global.css`'s, on `[data-sonner-toaster]` beside the tokens — sonner's
// `richColors` with its variables pointed at 082's tiers — never at a call site.

/** `<html dir>` as it stands, re-read whenever the attribute changes. */
function subscribeDirection(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] })
  return () => observer.disconnect()
}

export default function ToasterHost() {
  // Sonner doesn't watch the `.dark` class — feed it the app's theme store.
  const dark = useTheme((s) => s.dark)
  // Direction is a boot fact (F22), but sonner's corners are physical, so the end corner
  // is re-read if `dir` ever moves rather than trusted from boot.
  const dir = useSyncExternalStore(subscribeDirection, documentDirection)
  return (
    <Toaster
      position={toasterPositionFor(dir)}
      dir={dir}
      offset={16}
      richColors
      closeButton
      duration={6000}
      theme={dark ? 'dark' : 'light'}
    />
  )
}
