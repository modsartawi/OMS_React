import type { Severity } from '@/core/ui/severity'
import type { ScriptState, ScriptStoreRow, SentScript, StoreScript } from '@/core/models/sync-console'
import { codeBadge, type CodeBadge } from './helpers'
import { scriptBadge } from './store-helpers'

/**
 * The Scripts page's pure rules (ticket 663, BackOffice spec 3202 D6/D11, door 3207). Every
 * state is HQ's to derive; the page only words and orders what the door sends.
 */

/** The five derived states, in the order the list's counts read (the ticket's). */
export const SCRIPT_STATES: readonly ScriptState[] = ['executed', 'pending', 'retrying', 'exhausted', 'withdrawn']

const STATE_SEVERITY: Record<ScriptState, Severity> = {
  executed: 'ok',
  pending: 'mute',
  retrying: 'warn',
  exhausted: 'bad',
  withdrawn: 'mute',
}

/**
 * A store's state as a badge. "Exhausted" is the glossary's word for a store that used up its
 * attempts, never "failed" (a failed attempt can still be retried on its own) or "dead". A state
 * this bundle does not know is neutral with no key, so the raw code shows.
 */
export function scriptStateBadge(state: string): CodeBadge {
  return codeBadge(STATE_SEVERITY, 'scriptStates', state)
}

/**
 * The store page's Scripts tab state: the door's derived state when it sends one (3207), else the
 * tab's older reading of `isExecuted` and the last error, on a door that predates the state.
 */
export function storeScriptBadge(s: Pick<StoreScript, 'isExecuted' | 'errorMessage' | 'state'>): CodeBadge {
  return s.state === null ? scriptBadge(s) : scriptStateBadge(s.state)
}

/** A list row's five counts, in `SCRIPT_STATES` order, each with its label key. */
export function scriptCounts(
  s: Pick<SentScript, ScriptState>,
): { state: ScriptState; n: number; labelKey: string; sev: Severity }[] {
  return SCRIPT_STATES.map((state) => ({ state, n: s[state], labelKey: `scriptStates.${state}`, sev: STATE_SEVERITY[state] }))
}

/**
 * Whether a script is legacy (no `ActionSyncScript` row): the list says so with `isLegacy`; a
 * store-tab row has no flag, and a legacy one comes with no title (a sent one cannot: the send
 * door refuses `TITLE_REQUIRED`). A legacy script is drawn as "untitled (legacy)" in the bundle's
 * words, never the door's.
 */
export function scriptIsLegacy(s: { title: string | null; isLegacy?: boolean }): boolean {
  return s.isLegacy === true || s.title === null || s.title.trim() === ''
}

/** The target's label key (`all` / `chosen`, any case), or `null` for a legacy script or an unknown mode. */
export function scriptTargetKey(mode: string | null): string | null {
  const m = mode?.toLowerCase()
  return m === 'all' || m === 'chosen' ? `scriptsPage.targets.${m}` : null
}

/**
 * The detail's per-store order: what needs a hand first. Exhausted stores lead (only a hand
 * retry or a withdraw moves them), then retrying, pending, withdrawn, executed; a state this
 * bundle does not know goes last. The door's order is kept within a state.
 */
const STORE_ORDER: readonly ScriptState[] = ['exhausted', 'retrying', 'pending', 'withdrawn', 'executed']

export function orderScriptStores(rows: readonly ScriptStoreRow[]): ScriptStoreRow[] {
  const rank = (state: string) => {
    const i = (STORE_ORDER as readonly string[]).indexOf(state)
    return i === -1 ? STORE_ORDER.length : i
  }
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => rank(a.row.state) - rank(b.row.state) || a.i - b.i)
    .map(({ row }) => row)
}

/** The list's page size; the door pages it, newest first. */
export const SCRIPTS_PAGE_SIZE = 50
