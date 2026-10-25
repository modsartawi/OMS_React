import type { Severity } from '@/core/ui/severity'
import type { HungerStationOrderOutcome } from '@/core/models/hungerstation'

// The words and tones of a HungerStation order (spec 3028, ticket 556): its outcome, its alert and
// each delivery's run. Pure: no React, no `t` — each function hands back KEYS in
// `hungerstation-orders`, the page translates them.

const OUTCOME_SEV: Record<HungerStationOrderOutcome, Severity> = {
  created: 'ok',
  cancelled: 'mute',
  failed: 'bad',
  // Still being turned into a document — in motion, not yet a problem.
  pending: 'go',
}

/** A **HungerStation order outcome** in words; one the contract does not name is shown raw, neutral. */
export function outcomeLabel(outcome: string): { key: string | null; sev: Severity } {
  return Object.hasOwn(OUTCOME_SEV, outcome)
    ? { key: `outcomes.${outcome}`, sev: OUTCOME_SEV[outcome as HungerStationOrderOutcome] }
    : { key: null, sev: 'mute' }
}

/** What an alert says: a badge, a title and a hint, and the action it names (a link's words), if any. */
export interface AlertLabel {
  badge: string
  title: string
  hint: string
  action: string | null
}

/**
 * An order's alert in words, or `null` for none. v1 names only `unmatched` — the vendor id belongs
 * to no onboarded store, and its action is to onboard (or revive) the store on the Stores page:
 * a retry cannot help until then. An alert the contract does not name still says a person must
 * look, rather than vanishing.
 */
export function alertLabel(alert: string | null | undefined): AlertLabel | null {
  if (!alert) return null
  const name = alert === 'unmatched' ? 'unmatched' : 'other'
  return {
    badge: `alert.${name}.badge`,
    title: `alert.${name}.title`,
    hint: `alert.${name}.hint`,
    action: name === 'unmatched' ? 'alert.unmatched.action' : null,
  }
}

const RUN: Record<string, { key: string; sev: Severity }> = {
  C: { key: 'runs.done', sev: 'ok' },
  P: { key: 'runs.waiting', sev: 'go' },
  F: { key: 'runs.stopped', sev: 'bad' },
}

/**
 * A delivery's run in words: `C` done, `P` waiting, `F` stopped with an error. `null` — no run —
 * means the intake failed before a run was written. A status the contract does not name (the
 * server maps `R` and `E` to `P`, so none should arrive) is shown raw, neutral.
 */
export function runLabel(run: { status: string } | null): { key: string | null; sev: Severity; raw: string | null } {
  if (run === null) return { key: 'runs.none', sev: 'bad', raw: null }
  const known = Object.hasOwn(RUN, run.status) ? RUN[run.status] : null
  return known ? { ...known, raw: null } : { key: null, sev: 'mute', raw: run.status }
}
