/**
 * Whether the app-wide palette is open, and who may open it (ticket 392, spec 380 K7).
 *
 * The palette is hosted once, at `ProtectedLayout`; two things open it — the Ctrl+K chord
 * (`usePaletteChord`) and the top bar's palette field (F11). Both remember where focus
 * was, because by the time the palette's own effects run its box already holds the
 * caret: the one moment the answer exists is the press itself.
 */
import { useEffect } from 'react'
import { create } from 'zustand'
import { paletteChordAction } from './chord'

interface PaletteState {
  open: boolean
  /** Mounted hosts. The top bar's field renders only while one exists. */
  hosts: number
}

export const usePalette = create<PaletteState>(() => ({ open: false, hosts: 0 }))

/** Where focus was when the palette opened — put back when nothing was chosen. */
let cameFrom: HTMLElement | null = null

export function openPalette(from: Element | null): void {
  cameFrom = from instanceof HTMLElement ? from : null
  usePalette.setState({ open: true })
}

export function closePalette(): void {
  usePalette.setState({ open: false })
}

/** Puts focus back where it was when the palette opened, if that element still exists. */
export function returnPaletteFocus(): void {
  const to = cameFrom
  cameFrom = null
  if (to?.isConnected) to.focus()
}

/**
 * Any open dialog: a native one, or a hand-drawn modal (the saved-view dialog, the
 * phone drawer) that marks itself `aria-modal`. The palette over either would navigate
 * away from a half-filled decision.
 */
const OPEN_DIALOG = 'dialog[open], [role="dialog"][aria-modal="true"]'

/**
 * Marks a palette host as mounted, and binds Ctrl+K to it for that long.
 *
 * 🚩 One host, one listener: a route that opts out of the palette (a print route, the
 * call center until 395) mounts no host, so a screen never has two Ctrl+K handlers.
 */
export function usePaletteHost(): void {
  useEffect(() => {
    usePalette.setState((s) => ({ hosts: s.hosts + 1 }))
    const onKey = (event: KeyboardEvent) => {
      const act = paletteChordAction(event, { dialogOpen: document.querySelector(OPEN_DIALOG) !== null })
      if (act === 'ignore') return
      // 🚩 Prevented BEFORE the inert check, never after (K4): inert means the app does
      // nothing, never that the browser does something.
      event.preventDefault()
      if (act === 'open') openPalette(document.activeElement)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      usePalette.setState((s) => ({ hosts: s.hosts - 1, open: s.hosts - 1 > 0 && s.open }))
    }
  }, [])
}
