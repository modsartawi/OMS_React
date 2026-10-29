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
  return codeBadge(STATE_SEVERITY, 'scriptStates', scriptStateKey(state))
}

/** A state as this bundle keys it: lowercase, in whatever case the door sends it (as `scriptTargetKey`). */
function scriptStateKey(state: string): string {
  return state.toLowerCase()
}

/**
 * The store page's Scripts tab state: the door's derived state when it sends one (3207), else the
 * tab's older reading of `isExecuted` and the last error, on a door that predates the state.
 */
export function storeScriptBadge(s: Pick<StoreScript, 'isExecuted' | 'errorMessage' | 'state'>): CodeBadge {
  return s.state === null ? scriptBadge(s) : scriptStateBadge(s.state)
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

/**
 * A store-tab row's title (review 1). A door older than 3207 sends none of `title`, `attempts` or
 * `state` (all filled `null` at the boundary), so a `null` title with no state is **unsent**:
 * the cell is blank, as the tab was before 3207. On a 3207 door every row carries a state, and a
 * `null` (or blank) title there is a **legacy** script, drawn as "untitled (legacy)".
 */
export function storeScriptTitle(s: Pick<StoreScript, 'title' | 'state'>): 'unsent' | 'legacy' | 'titled' {
  if (s.state === null && s.title === null) return 'unsent'
  return scriptIsLegacy(s) ? 'legacy' : 'titled'
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
    const i = (STORE_ORDER as readonly string[]).indexOf(scriptStateKey(state))
    return i === -1 ? STORE_ORDER.length : i
  }
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => rank(a.row.state) - rank(b.row.state) || a.i - b.i)
    .map(({ row }) => row)
}

/**
 * A script's store rows counted by state, as the list's five counts read (ticket 673). The Detail
 * door sends each store's row and no counts (contract "Store script doors"), so the detail's
 * controls count its own rows; a state this bundle does not know counts nowhere.
 */
export function scriptStateCounts(rows: readonly Pick<ScriptStoreRow, 'state'>[]): Record<ScriptState, number> {
  const counts: Record<ScriptState, number> = { executed: 0, pending: 0, retrying: 0, exhausted: 0, withdrawn: 0 }
  for (const r of rows) {
    const k = scriptStateKey(r.state)
    if ((SCRIPT_STATES as readonly string[]).includes(k)) counts[k as ScriptState]++
  }
  return counts
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
 * The SQL's first character above U+007F (ticket 673), by its 1-based position and code point, or
 * `null` when it is all ASCII (CR, LF and tab are). The send door refuses such a script
 * (`SCRIPT_NOT_ASCII`: `Script.ScriptContext` is bound ANSI); the dialog warns before the preview,
 * and the door stays the judge.
 */
export function firstNonAscii(sql: string): { position: number; codePoint: string } | null {
  for (let i = 0; i < sql.length; i++) {
    const c = sql.charCodeAt(i)
    if (c > 0x7f) return { position: i + 1, codePoint: `U+${(sql.codePointAt(i) ?? c).toString(16).toUpperCase().padStart(4, '0')}` }
  }
  return null
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

/** A sender, on a script not withdrawn (a left-out `withdrawnAt` is not): the door's `WITHDRAWN` refuses both writes. */
const writable = (s: Pick<SentScript, 'withdrawnAt'>, access: RunScriptsAccess): boolean =>
  access?.canRunScripts === true && s.withdrawnAt == null

/**
 * The detail footer's controls. Absent, never disabled, without `canRunScripts` (`=== true`, so a
 * door older than 3205 that leaves the flag out reads as no) and on a withdrawn script (the door's
 * `WITHDRAWN`).
 *
 * - **Withdraw**: some store has not run it yet (pending, retrying or exhausted). With every store
 *   executed there is nothing a withdraw would mark. Never on a legacy script: the door refuses it
 *   `LEGACY_SCRIPT`.
 * - **Retry all exhausted**: some store is exhausted (the door's `NOT_EXHAUSTED` otherwise). A
 *   legacy script's exhausted stores are retried too (spec 3202, changed after review: its rows obey
 *   the cap, so only a retry revives them).
 *
 * The counts are read as given (the list's, or the detail's own stores through
 * `scriptStateCounts`); the door re-checks every write.
 */
export function scriptControls(
  s: Pick<SentScript, 'isLegacy' | 'title' | 'withdrawnAt' | 'pending' | 'retrying' | 'exhausted'>,
  access: RunScriptsAccess,
): { withdraw: boolean; retryAll: boolean } {
  if (!writable(s, access)) return { withdraw: false, retryAll: false }
  return { withdraw: !scriptIsLegacy(s) && s.pending + s.retrying + s.exhausted > 0, retryAll: s.exhausted > 0 }
}

/** A store row's own Retry: the row is exhausted, on a script not withdrawn, legacy or not, to a sender. */
export function storeRetryOffered(
  row: Pick<ScriptStoreRow, 'state'>,
  s: Pick<SentScript, 'withdrawnAt'>,
  access: RunScriptsAccess,
): boolean {
  return writable(s, access) && scriptStateKey(row.state) === 'exhausted'
}

/**
 * The script doors' refusals the bundle words (`scriptCodes.*`). `BAD_REQUEST` and
 * `REASON_REQUIRED` are not here: the dialogs never send a request without a reason.
 */
export const SCRIPT_REFUSALS = [
  'TITLE_REQUIRED',
  'TITLE_TOO_LONG',
  'SCRIPT_EMPTY',
  'SCRIPT_HAS_GO',
  'SCRIPT_TOO_LONG',
  'SCRIPT_NOT_ASCII',
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

/** The `data` members the store refusals carry their codes in (contract "Store script doors"), in reading order. */
const REFUSED_STORE_MEMBERS = ['unknown', 'notEligible', 'notExhausted'] as const

/**
 * The store codes a refusal names, off its `data` (ticket 673, the doors' final shapes): a
 * chosen-store send refusal's `{ unknown, notEligible }` (`UNKNOWN_STORE` / `NOT_ELIGIBLE`, the
 * unknown codes first) and a retry refusal's `{ notExhausted }`, each as the sender typed it. Any
 * other shape names none; the door's message names the codes too and is always shown.
 */
export function refusedStoreCodes(data: unknown): string[] {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return []
  const d = data as Partial<Record<(typeof REFUSED_STORE_MEMBERS)[number], unknown>>
  return REFUSED_STORE_MEMBERS.flatMap((m) => {
    const codes = d[m]
    return Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string') : []
  })
}
