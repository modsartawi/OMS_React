import { useEffect } from 'react'

/**
 * Mount `@page { size: A4; margin: 0 }` for as long as a print route is on
 * screen, and take it away again on the way out.
 *
 * ⚠ Why this is not a line in the facsimile's stylesheet, which is where it
 * belongs by every other measure: `@page` is a **global** at-rule, and an
 * imported stylesheet is never unloaded — Vite injects the route's CSS chunk on
 * lazy-load and leaves it in `document.styleSheets` forever. Written there, one
 * visit to a receipt would silently print every other screen in the app
 * edge-to-edge for the rest of the session. A route-scoped rule cannot.
 *
 * No margin box means the browser has nowhere to stamp its URL/date header and
 * footer — there is no CSS or script lever for that stamp, only this one
 * (241, gotcha 1). A user who re-enables margins in the print dialog gets the
 * stamp back, which is 260's paper question, not something this can close. The
 * document carries its own inner padding instead.
 *
 * Ticket 252's ACR route calls this too — the geometry is the same sheet.
 */
export function usePrintPageA4() {
  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.printPage = 'a4'
    style.textContent = '@page { size: A4; margin: 0; }'
    document.head.appendChild(style)
    return () => style.remove()
  }, [])
}
