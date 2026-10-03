/**
 * The one key layer (ticket 393, spec 380 K3–K5; ruling 365 §3–§4): a single `keydown`
 * listener, bound by the palette's host at `ProtectedLayout`, that serves the core's own
 * keys (Ctrl+K, `?`) and every mounted command's `keys`. No screen adds a second one.
 *
 * It listens on `window`, in the bubble phase — the LAST stop. Every control, popover and
 * box has had the press first, so one that took it (`preventDefault`) keeps it (368), and
 * an Esc reaches the screen only once every layer above has passed on it:
 * native dialog → popover/menu → in-box clear → the screen's Esc command.
 *
 * 🚩 **Keys only open** (K5). A bound key runs the very handler the palette row runs —
 * and a command the page would refuse right now **toasts its reason**, coalesced under
 * one id so a held key cannot stack them. It is never a silent dead key.
 */
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import i18n from '@/core/i18n'
import { isPaletteChord } from './chord'
import { fireDecision, focusKindOf } from './fire-tier'
import { bindKeys, eventKeys, SHEET_KEYS, type RefusedKey } from './keys'
import { openPalette } from './palette-store'
import { registeredNow } from './registry'
import { openShortcuts } from './shortcuts-sheet'
import { useSingleKeys } from './single-key-switch'

/**
 * Any open dialog: a native one, or a hand-drawn modal (the saved-view dialog, the phone
 * drawer) that marks itself `aria-modal`. Every tier treats both alike (392's ruling).
 */
const OPEN_DIALOG = 'dialog[open], [role="dialog"][aria-modal="true"]'

export function anyDialogOpen(): boolean {
  return document.querySelector(OPEN_DIALOG) !== null
}

/**
 * For a popover's or a menu's own Esc listener: true when this press is the layer's to
 * take — nothing has taken it yet, and no dialog has opened OVER the layer (a dialog the
 * layer sits inside is its own). A layer that takes it calls `preventDefault`, so the
 * layers under it, and the screen's Esc command, pass on it.
 */
export function takesEscape(event: KeyboardEvent, layer: Element | null): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented) return false
  for (const dialog of document.querySelectorAll(OPEN_DIALOG)) {
    if (!layer || !dialog.contains(layer)) return false
  }
  return true
}

/** One toast id for every refused key: a held key updates it rather than stacking more. */
const REFUSED_TOAST = 'core-key-refused'

function refuse(reason: string | null | undefined): void {
  toast(i18n.t(reason ?? 'common:shortcuts.refused'), { id: REFUSED_TOAST })
}

const reported = new Set<string>()

/**
 * The registry's refusals (K3), as dev-time errors — each once, however often the page
 * re-registers. The refused key binds nothing; the first binding wins.
 */
export function reportRefusals(refused: readonly RefusedKey[]): void {
  if (!import.meta.env.DEV) return
  for (const r of refused) {
    const line = `[commands] "${r.command.id}" cannot take ${r.keys}: ${r.refusal}`
    if (reported.has(line)) continue
    reported.add(line)
    console.error(line)
  }
}

/**
 * Binds the key layer for as long as the host is mounted. `singleKeyScreen` is the
 * matched route's flag: only there do letters, `/` and `?` exist (365 §2).
 */
export function useKeyLayer(singleKeyScreen: boolean): void {
  const screen = useRef(singleKeyScreen)
  useEffect(() => {
    screen.current = singleKeyScreen
  }, [singleKeyScreen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const keys = eventKeys(event)
      if (keys === null) return
      const at = {
        event,
        focus: focusKindOf(document.activeElement),
        dialogOpen: anyDialogOpen(),
        switchOn: useSingleKeys.getState().on,
      }

      if (isPaletteChord(event)) {
        const decision = fireDecision(at)
        // 🚩 Prevented whatever the decision (K4): inert means the app does nothing,
        // never that the browser puts the caret in its address bar.
        event.preventDefault()
        if (decision === 'fire') openPalette(document.activeElement)
        return
      }

      if (keys === SHEET_KEYS && screen.current) {
        if (fireDecision(at) !== 'fire') return
        event.preventDefault()
        openShortcuts(document.activeElement)
        return
      }

      const command = bindKeys(registeredNow(), { singleKeyScreen: screen.current }).bound.get(keys)
      if (!command) return
      const decision = fireDecision({ ...at, repeatable: command.hidden === true })
      if (decision === 'skip') return
      event.preventDefault()
      if (decision === 'blur') {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        return
      }
      if (command.run) command.run()
      else refuse(command.reason)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
