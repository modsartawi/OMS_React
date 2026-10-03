/**
 * Delivery details' keys (spec 380 D10, ticket 405; ruling 365 §6), as the commands the page
 * registers through `useCommands`. Each one is also a palette row, and the shortcuts sheet lists
 * the bound ones, so a key can only do what a row does.
 *
 * | Key | Does |
 * |---|---|
 * | `R` / `C` | Reschedule and Request cancellation, through the command bar's own gate. A refused one toasts its button's reason. |
 * | `N` | Focuses the note composer. |
 * | `Esc` | Back to the list. In a text box the key layer only blurs it, so a second Esc goes back. **Refused while the composer holds unsent text**, with a toast. |
 *
 * `?` is the core's. **Ctrl+Enter is not here**: it is the composer form's own submit, from the
 * composer only, never a key that writes from anywhere on the page (K5). **No J/K** next/previous
 * delivery on details (365 §6).
 *
 * Letters exist only on a single-key screen (365 §2), which is the delivery route; on the
 * document route the same commands stay palette rows with no key, and Esc keeps its own.
 */
import { CalendarClock, Flag, List, Plus } from 'lucide-react'
import type { Command } from '@/core/commands/palette-model'
import type { CommandKind } from './actions'
import { commandGate, type CommandContext } from './commands'
import { backRefusal, type ComposerState } from './composer'

export const DETAIL_KEYS = {
  reschedule: 'KeyR',
  'request-close': 'KeyC',
  composer: 'KeyN',
  back: 'Escape',
} as const

/**
 * The hints the screen draws for its bound keys: R / C / N on the command bar's buttons (D3) and
 * N on the composer. None off the single-key screen, where the letters are not bound.
 */
export function keyHints(singleKeyScreen: boolean): {
  bar: Partial<Record<CommandKind, string>>
  composer: string | null
} {
  if (!singleKeyScreen) return { bar: {}, composer: null }
  return {
    bar: {
      reschedule: DETAIL_KEYS.reschedule,
      'request-close': DETAIL_KEYS['request-close'],
      'add-note': DETAIL_KEYS.composer,
    },
    composer: DETAIL_KEYS.composer,
  }
}

/** The two acts a key opens: the same two the list's R / C ask Details to open (401). */
export type KeyedAct = 'reschedule' | 'request-close'
const ACT_ICON: Record<KeyedAct, Command['icon']> = { reschedule: CalendarClock, 'request-close': Flag }

export function detailCommands(input: {
  /** What the command bar gates on, or `null` until the header has loaded. */
  context: CommandContext | null
  composer: ComposerState
  singleKeyScreen: boolean
  back: () => void
  focusComposer: () => void
  command: (kind: KeyedAct) => void
}): Command[] {
  const { context, composer, singleKeyScreen } = input
  const letter = (keys: string) => (singleKeyScreen ? keys : undefined)

  /** The bar's own gate: busy refuses with no reason; a state reason is the button's words. */
  const act = (kind: KeyedAct, ctx: CommandContext): Command => {
    const { disabled, reasonKey } = commandGate(kind, ctx)
    return {
      id: `act.${kind}`,
      label: `document:actions.${kind}`,
      icon: ACT_ICON[kind],
      keys: letter(DETAIL_KEYS[kind]),
      run: disabled ? null : () => input.command(kind),
      reason: reasonKey === null ? null : `document:${reasonKey}`,
    }
  }

  const refusal = backRefusal(composer)
  const back: Command = {
    id: 'back',
    // One label per act: the header's chevron is this same Back.
    label: 'document:back',
    icon: List,
    keys: DETAIL_KEYS.back,
    run: refusal === null ? input.back : null,
    reason: refusal,
  }

  if (!context) return [back]
  return [
    act('reschedule', context),
    act('request-close', context),
    {
      id: 'composer.focus',
      label: 'document:actions.add-note',
      icon: Plus,
      keys: letter(DETAIL_KEYS.composer),
      run: input.focusComposer,
    },
    back,
  ]
}
