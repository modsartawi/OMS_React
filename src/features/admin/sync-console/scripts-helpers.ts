import type { Severity } from '@/core/ui/severity'
import type {
  RetryScriptResponse,
  ScriptState,
  ScriptStoreRow,
  ScriptTarget,
  SendScriptResponse,
  SentScript,
  StoreScript,
  SyncConsoleAccess,
  WithdrawScriptResponse,
} from '@/core/models/sync-console'
import { formatCount } from '@/core/util/bidi'
import { codeBadge, figure, type CodeBadge } from './helpers'
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

// ── Ticket 664: Send, Withdraw and Retry (spec 3202 D2, D7, D9, D10, D11; doors 3205/3206) ──

/** The send door's cap on the SQL (`SCRIPT_TOO_LONG`, the `StringType` width of `ScriptContext`). */
export const SCRIPT_MAX_CHARS = 8000

/** The SQL's length against the cap, as the dialog counts it (`n / 8,000`, one isolated count). */
export function scriptSqlLength(sql: string): { n: number; over: boolean; text: string } {
  const n = sql.length
  return { n, over: n > SCRIPT_MAX_CHARS, text: formatCount(figure(n), figure(SCRIPT_MAX_CHARS)) }
}

/**
 * The target's part of a send body. `all` sends no codes (the door freezes the eligible set at
 * send time); `chosen` sends the codes picked, in order, each once — an empty pick is still sent,
 * so the door answers it (`NO_STORES`) rather than the screen guessing.
 */
export function sendTargetBody(target: ScriptTarget, codes: readonly string[]): { target: ScriptTarget; codes?: string[] } {
  return target === 'all' ? { target } : { target, codes: [...new Set(codes)] }
}

/** A preview's one counted sentence: the key (pluralised on `count`) and the grouped figure. */
export interface PreviewSentence {
  key: string
  count: number
  n: string
}

const counted = (key: string, count: number): PreviewSentence => ({ key, count, n: figure(count) })

/** The send preview: how many stores, exactly, the script would reach (the dialog lists them after it). */
export const sendPreviewSentence = (r: SendScriptResponse): PreviewSentence => counted('scriptSend.preview.stores', r.stores.length)

/** The withdraw preview: how many stores have not run it, and would be withdrawn. */
export const withdrawPreviewSentence = (r: WithdrawScriptResponse): PreviewSentence => counted('scriptWithdraw.preview', r.storesWithdrawn)

/** The retry preview: how many exhausted stores would get five fresh attempts. */
export const retryPreviewSentence = (r: RetryScriptResponse): PreviewSentence => counted('scriptRetry.preview', r.storesRetried)

type RunScriptsAccess = Pick<SyncConsoleAccess, 'canRunScripts'> | null | undefined

/** A script the controls may touch: sent from the console (not legacy) and not withdrawn. */
const controllable = (s: Pick<SentScript, 'isLegacy' | 'title' | 'withdrawnAt'>, access: RunScriptsAccess): boolean =>
  access?.canRunScripts === true && !scriptIsLegacy(s) && s.withdrawnAt === null

/**
 * The detail footer's controls. Absent, never disabled, without `canRunScripts` (`=== true`, so a
 * door older than 3205 that leaves the flag out reads as no), on a legacy script and on a
 * withdrawn one (the door's `LEGACY_SCRIPT` / `WITHDRAWN`).
 *
 * - **Withdraw**: some store has not run it yet (pending, retrying or exhausted). With every store
 *   executed there is nothing a withdraw would mark.
 * - **Retry all exhausted**: some store is exhausted (the door's `NOT_EXHAUSTED` otherwise).
 *
 * The counts are the list's, read as the door sends them; the door re-checks every write.
 */
export function scriptControls(
  s: Pick<SentScript, 'isLegacy' | 'title' | 'withdrawnAt' | 'pending' | 'retrying' | 'exhausted'>,
  access: RunScriptsAccess,
): { withdraw: boolean; retryAll: boolean } {
  if (!controllable(s, access)) return { withdraw: false, retryAll: false }
  return { withdraw: s.pending + s.retrying + s.exhausted > 0, retryAll: s.exhausted > 0 }
}

/** A store row's own Retry: the row is exhausted, on a script the controls may touch. */
export function storeRetryOffered(
  row: Pick<ScriptStoreRow, 'state'>,
  s: Pick<SentScript, 'isLegacy' | 'title' | 'withdrawnAt'>,
  access: RunScriptsAccess,
): boolean {
  return controllable(s, access) && row.state === 'exhausted'
}

/**
 * The script doors' refusals the bundle words (`scriptCodes.*`). `BAD_REQUEST` and
 * `REASON_REQUIRED` are not here: the dialogs never send a request without a reason.
 */
export const SCRIPT_REFUSALS = [
  'TITLE_REQUIRED',
  'SCRIPT_EMPTY',
  'SCRIPT_HAS_GO',
  'SCRIPT_TOO_LONG',
  'UNKNOWN_STORE',
  'NOT_ELIGIBLE',
  'NO_STORES',
  'UNKNOWN_SCRIPT',
  'LEGACY_SCRIPT',
  'WITHDRAWN',
  'NOT_EXHAUSTED',
] as const

/** A refusal code's words as a `sync-console` key, or `null` for one the bundle does not know (the code shows alone). */
export function scriptRefusalKey(code: string): string | null {
  return (SCRIPT_REFUSALS as readonly string[]).includes(code) ? `scriptCodes.${code}` : null
}

/**
 * The store codes a refusal names (`UNKNOWN_STORE`, `NOT_ELIGIBLE`, `NOT_EXHAUSTED`), read off the
 * refusal's `data.codes`. 🚩 Guessed: D11 says only that the refusal names them; the door's message
 * names them too and is always shown, so a door that sends no list loses nothing.
 */
export function refusedStoreCodes(data: unknown): string[] {
  if (data === null || typeof data !== 'object') return []
  const codes = (data as { codes?: unknown }).codes
  return Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string') : []
}
