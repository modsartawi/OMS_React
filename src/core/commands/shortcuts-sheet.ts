/**
 * The shortcuts sheet's lines and whether it is open (ticket 393, spec 380 K16).
 *
 * The lines are **generated from the registry**: the app-wide keys, then the mounted
 * screen's commands that are actually bound — hidden ones (J/K) included, refused ones
 * not — so the sheet cannot drift from what the keys do.
 *
 * Three things open it — `?` on a single-key screen, its palette row and the user menu —
 * and each remembers where focus was, so closing the sheet puts it back.
 */
import { create } from 'zustand'
import { bindKeys, boundKeysOf, PALETTE_KEYS, SHEET_KEYS } from './keys'
import type { Command } from './palette-model'

/** One line of the sheet: what it does (an i18n key) and the key that does it. */
export interface SheetLine {
  id: string
  label: string
  keys: string
}

/** The app-wide keys — the core's own. `?` only where it is live (a single-key screen). */
export function appWideLines(at: { singleKeyScreen: boolean }): SheetLine[] {
  return [
    { id: 'palette', label: 'common:shortcuts.app.palette', keys: PALETTE_KEYS },
    ...(at.singleKeyScreen ? [{ id: 'sheet', label: 'common:shortcuts.app.sheet', keys: SHEET_KEYS }] : []),
    { id: 'esc', label: 'common:shortcuts.app.esc', keys: 'Escape' },
  ]
}

/** The mounted screen's commands that are actually bound, in registration order. */
export function screenLines(commands: readonly Command[], at: { singleKeyScreen: boolean }): SheetLine[] {
  const bindings = bindKeys(commands, at)
  return commands.flatMap((command) => {
    const keys = boundKeysOf(command, bindings)
    return keys ? [{ id: command.id, label: command.label, keys }] : []
  })
}

export const useShortcutsSheet = create<{ open: boolean }>(() => ({ open: false }))

let cameFrom: HTMLElement | null = null

export function openShortcuts(from: Element | null): void {
  cameFrom = from instanceof HTMLElement ? from : null
  useShortcutsSheet.setState({ open: true })
}

export function closeShortcuts(): void {
  useShortcutsSheet.setState({ open: false })
}

/**
 * Shut, and forgetting where it came from — for the host unmounting (a navigation to a
 * route with no palette), so the next host does not open the sheet by itself.
 */
export function resetShortcuts(): void {
  cameFrom = null
  useShortcutsSheet.setState({ open: false })
}

/** Puts focus back where it was when the sheet opened, if that element still exists. */
export function returnShortcutsFocus(): void {
  const to = cameFrom
  cameFrom = null
  if (to?.isConnected) to.focus()
}
