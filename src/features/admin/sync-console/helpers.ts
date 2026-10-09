/**
 * The Fleet page's pure logic (spec 444, ticket 445). No React, no network — these
 * are where a regression would be silent, so each one is pinned by `helpers.test.ts`.
 *
 * 🚩 **States come from the door.** Nothing here decides whether a store is
 * offline, behind or erroring; `stateBadge` only names and colours what `states[]`
 * already says.
 */
import type { Severity } from '@/core/ui/severity'
import {
  STORE_STATES,
  type FleetSort,
  type StoreRow,
  type StoreState,
  type SyncWorker,
} from '@/core/models/sync-console'

/** The door pages; the console asks for 50 a page (spec 444). */
export const FLEET_PAGE_SIZE = 50

/** The fleet page refetches on the worker's own health-flush cadence (spec 444). */
export const FLEET_REFRESH_MS = 30_000

/** A count as the console draws it: grouped, `12,345`. One spelling for every figure. */
export const figure = (n: number): string => n.toLocaleString('en-US')

// ── State → label + severity ────────────────────────────────────────────────────

const STATE_SEVERITY: Record<StoreState, Severity> = {
  onWorker: 'go',
  onWpf: 'mute',
  paused: 'mute',
  offline: 'bad',
  behind: 'warn',
  erroring: 'bad',
  controlPending: 'go',
}

const isStoreState = (s: string): s is StoreState => Object.hasOwn(STATE_SEVERITY, s)

/**
 * A state's badge: its `sync-console` label key and its severity.
 *
 * An unknown state (a door newer than this bundle) is **neutral** and has no key —
 * the caller shows the raw code rather than inventing a word for it.
 */
export function stateBadge(state: string): { labelKey: string | null; sev: Severity } {
  if (!isStoreState(state)) return { labelKey: null, sev: 'mute' }
  return { labelKey: `states.${state}`, sev: STATE_SEVERITY[state] }
}

// ── The fleet query ─────────────────────────────────────────────────────────────

export type FleetHostFilter = 'Worker' | 'Wpf' | null

/** Everything the store table is asked for — tiles, filters, sort and page in one object. */
export interface FleetFilter {
  /** The tiles chosen; sent as a REPEATED `state` (the door ANDs them). Empty = All. */
  states: StoreState[]
  host: FleetHostFilter
  q: string
  sort: FleetSort
  page: number
}

export const FLEET_SORTS: readonly FleetSort[] = ['mostBehind', 'longestOffline', 'newestError', 'code']

export const DEFAULT_FLEET_FILTER: FleetFilter = {
  states: [],
  host: null,
  q: '',
  sort: 'mostBehind',
  page: 1,
}

/** A tile: `all`, or one state. */
export type FleetTile = 'all' | StoreState

export const FLEET_TILES: readonly FleetTile[] = ['all', ...STORE_STATES]

/**
 * What clicking a tile does to the filter. `all` clears every state; a state tile
 * toggles that state in or out, so two tiles narrow to the stores in BOTH. The
 * states are kept in the contract's order, so the query string is the same however
 * the tiles were clicked. Any change goes back to page 1.
 */
export function toggleTile(filter: FleetFilter, tile: FleetTile): FleetFilter {
  if (tile === 'all') return { ...filter, states: [], page: 1 }
  const on = filter.states.includes(tile)
  const states = STORE_STATES.filter((s) => (s === tile ? !on : filter.states.includes(s)))
  return { ...filter, states, page: 1 }
}

/** Whether a tile reads as chosen: `all` when no state is, a state when it is in the filter. */
export function tileOn(filter: FleetFilter, tile: FleetTile): boolean {
  return tile === 'all' ? filter.states.length === 0 : filter.states.includes(tile)
}

/**
 * The `GET ActionSync/Fleet` parameters for a filter. `state` is an array, which
 * `@/core/api`'s query builder sends as a REPEATED key; a blank `q` and an Any host
 * are dropped there too. The search is trimmed, and the page never goes below 1.
 */
export function fleetQuery(filter: FleetFilter): Record<string, unknown> {
  return {
    state: filter.states,
    host: filter.host,
    q: filter.q.trim(),
    sort: filter.sort,
    page: Math.max(1, Math.floor(filter.page)),
    pageSize: FLEET_PAGE_SIZE,
  }
}

// ── The worker banner ───────────────────────────────────────────────────────────

/**
 * The red banner over the worker card, or `null` for none.
 *
 * - `stale`: the door flagged at least one worker `isStale` — its instances are named.
 * - `none`: no worker has ever reported. A fleet with no heartbeat at all is the
 *   loudest form of "a dead worker must never look like a quiet fleet" (story 3).
 */
export type WorkerBanner = { kind: 'stale'; instances: string[] } | { kind: 'none' }

export function workerBanner(workers: readonly SyncWorker[]): WorkerBanner | null {
  if (workers.length === 0) return { kind: 'none' }
  const stale = workers.filter((w) => w.isStale).map((w) => w.instance)
  return stale.length > 0 ? { kind: 'stale', instances: stale } : null
}

// ── A row's last error ──────────────────────────────────────────────────────────

/**
 * The newer of a row's push and pull errors, for the table's one "Last error" cell.
 * The two times are compared as strings: the contract's fixed
 * `yyyy-MM-ddTHH:mm:ss` sorts lexically, so no `Date` is built from a server time.
 */
export function lastLoopError(row: Pick<StoreRow, 'push' | 'pull'>): { at: string; error: string } | null {
  const found = [row.push, row.pull]
    .filter((l) => l.lastError && l.lastErrorAt)
    .map((l) => ({ at: l.lastErrorAt as string, error: l.lastError as string }))
  if (found.length === 0) return null
  return found.reduce((a, b) => (b.at > a.at ? b : a))
}
