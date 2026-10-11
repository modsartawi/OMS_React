/**
 * The ladder's state codes as the console reads them (BackOffice spec 2579, ticket 461).
 * Pure, pinned by `state-helpers.test.ts`.
 *
 * The meanings are the door contract's table, held as i18n keys (`states.<code>`): the
 * contract fixes the meaning, oms-react owns the display text.
 */
import { STATE_CODES, type StateCode, type StateCounts } from '@/core/models/sap-export'

const KNOWN: ReadonlySet<string> = new Set(STATE_CODES)

/** A state code's meaning key, or `null` for a code this bundle does not know (the raw code shows). */
export function stateMeaningKey(code: string): string | null {
  return KNOWN.has(code) ? `states.${code}` : null
}

export type PresentState = { code: string; count: number }

/**
 * The legend's entries: every code with a non-zero count, in the contract's order. A code the
 * door sent that this bundle does not know is kept, after the known ones, rather than dropped.
 * A code in `chosen` (an active filter) is listed even at 0, so a filter a newer read no longer
 * counts can still be seen and turned off.
 */
export function presentStates(counts: StateCounts, chosen: readonly string[] = []): PresentState[] {
  const sent = counts as Record<string, number | undefined>
  const known = STATE_CODES.filter((c: StateCode) => (sent[c] ?? 0) > 0 || chosen.includes(c)).map((code) => ({ code, count: sent[code] ?? 0 }))
  const unknown = Object.keys(sent)
    .filter((c) => !KNOWN.has(c) && (sent[c] ?? 0) > 0)
    .map((code) => ({ code, count: sent[code] as number }))
  return [...known, ...unknown]
}
