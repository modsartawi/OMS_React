/**
 * Simulation's Process, as the command the page registers through `useCommands` (spec 380
 * M2, ticket 406; ruling 365 §8). One registration binds Ctrl+Enter while the page is
 * mounted, lists Process in the palette's This screen group with its hint, and puts it in
 * the shortcuts sheet.
 *
 * A simulation is a read, so K5's no-write rule does not reach it: the chord runs the very
 * handler the `▶ Process` button runs. The core key layer makes it **inert while a dialog
 * is open** (the chord tier), and a press the page would refuse **toasts its reason**,
 * coalesced, where the old window listener was a quiet no-op.
 *
 * Simulation has no single keys (365 §2): its resting focus is its form.
 */
import { Play } from 'lucide-react'
import type { Command } from '@/core/commands/palette-model'

/** Process's chord — the screen's Ctrl+Enter (K3). */
export const PROCESS_KEYS = 'Ctrl+Enter'

/**
 * Why Process cannot run right now, as an i18n key — the button's tooltip, the palette
 * row's reason and the refused chord's toast — or `null` when it can. A run in flight
 * comes first: it is the reason the press does nothing even once the basket is emptied.
 */
export function processRefusal(input: { itemCount: number; pending: boolean }): string | null {
  if (input.pending) return 'simulation:process.refused.running'
  if (input.itemCount === 0) return 'simulation:process.refused.noItems'
  return null
}

/**
 * The registered Process command: its handler present exactly when it can run (K2). `reason`
 * is `processRefusal`'s answer, the one the page also hands its button.
 */
export function processCommand(input: { reason: string | null; run: () => void }): Command {
  const { reason } = input
  return {
    id: 'process',
    // The button's own word: one label per act.
    label: 'simulation:actions.process',
    icon: Play,
    keys: PROCESS_KEYS,
    run: reason === null ? input.run : null,
    reason,
  }
}
