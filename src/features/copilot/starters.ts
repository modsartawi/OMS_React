import type { CopilotReaderStarters } from '@/core/models/copilot'
import { saysIn } from '@/core/rules/sentence'

/**
 * The empty panel's starters (ticket 873, BackOffice spec 3586 A52, A53; server half 3601). `GET Copilot/Starters`
 * gives the asking reader's starters; the empty panel offers them in its own language. When the door gives none (the
 * switch `Copilot:Answers:Starters` off, none saved, the reader's own list empty) or the read fails, the panel keeps its
 * two fixed examples, as before.
 */

/**
 * What a tap on a starter does (A52): asks it at once, saying it came from a starter; or, a starter with a blank to
 * fill, puts its text in the question box for the reader to complete, and sends nothing.
 */
export type StarterTap = { kind: 'ask'; question: string; origin: 'starter' } | { kind: 'fill'; text: string }

/** One starter as the empty panel offers it: its text in the panel's language, and what a tap does. */
export interface StarterButton {
  text: string
  tap: StarterTap
}

/** What the empty panel offers: the reader's starters, or its two fixed examples. */
export type EmptyPanelOffer = { kind: 'starters'; starters: StarterButton[] } | { kind: 'examples' }

/** A starters read that failed is nothing: the panel then shows its fixed examples, never an error. */
export function startersOrNothing(read: Promise<CopilotReaderStarters | null>): Promise<CopilotReaderStarters | null> {
  return read.then(
    (found) => found ?? null,
    () => null,
  )
}

/**
 * The empty panel's offer from the starters read (`null`: it failed). A starter that says nothing in either language
 * is dropped; none left is the fixed examples.
 */
export function emptyPanelOffer(read: CopilotReaderStarters | null | undefined, lang: string): EmptyPanelOffer {
  const list = Array.isArray(read?.starters) ? read.starters : []
  const starters = list.flatMap((s): StarterButton[] => {
    const text = saysIn(s?.question, lang).trim()
    if (text === '') return []
    const tap: StarterTap = s.blank ? { kind: 'fill', text } : { kind: 'ask', question: text, origin: 'starter' }
    return [{ text, tap }]
  })
  return starters.length > 0 ? { kind: 'starters', starters } : { kind: 'examples' }
}
