/**
 * Whether the app-wide palette is open, and who may open it (ticket 392, spec 380 K7).
 *
 * The palette is hosted once, at `ProtectedLayout`; two things open it — the Ctrl+K chord
 * (the key layer, `key-layer.ts`) and the top bar's palette field (F11). Both remember
 * where focus was, because by the time the palette's own effects run its box already
 * holds the caret: the one moment the answer exists is the press itself.
 */
import { useEffect } from 'react'
import { create } from 'zustand'

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

/**
 * Where focus was when the palette opened — for a chosen act that opens a surface of its
 * own (the shortcuts sheet), so that surface hands focus back there, not to the body.
 */
export function paletteOrigin(): HTMLElement | null {
  return cameFrom
}

/** Puts focus back where it was when the palette opened, if that element still exists. */
export function returnPaletteFocus(): void {
  const to = cameFrom
  cameFrom = null
  if (to?.isConnected) to.focus()
}

/**
 * Marks a palette host as mounted, for as long as it is. Ctrl+K itself is the key
 * layer's (`key-layer.ts`), the one listener every key goes through.
 *
 * 🚩 One host, one listener: a route that opts out of the palette (a print route) mounts
 * no host, and no screen keeps a Ctrl+K of its own (the call center's went with 395).
 */
export function usePaletteHost(): void {
  useEffect(() => {
    usePalette.setState((s) => ({ hosts: s.hosts + 1 }))
    return () => usePalette.setState((s) => ({ hosts: s.hosts - 1, open: s.hosts - 1 > 0 && s.open }))
  }, [])
}
