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
  MIRROR_STATES,
  STORE_STATES,
  type FleetSort,
  type MirrorState,
  type MirrorTickOutcome,
  type MirrorWorker,
  type StoreRow,
  type StoreState,
  type SyncWorker,
  type WorkerItem,
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
  // The mirror rail and rail agreement (2563) — severities as ruled for the wave.
  mirrorOffline: 'bad',
  mirrorBehind: 'warn',
  deadLetters: 'bad',
  deferredTooLong: 'warn',
  railsDisagree: 'bad',
}

/** A machine code's badge: its label key, or `null` for a code this bundle does not know. */
export type CodeBadge = { labelKey: string | null; sev: Severity }

/**
 * The one "code -> label + severity" lookup every badge of the console reads (states,
 * pass outcomes, detail lines). A code missing from the map (a door newer than this
 * bundle, or a key inherited from `Object.prototype`) is **neutral with no key**, so
 * the caller shows the raw code rather than inventing a word for it.
 */
export function codeBadge<K extends string>(map: Record<K, Severity>, keyPrefix: string, code: string): CodeBadge {
  if (!Object.hasOwn(map, code)) return { labelKey: null, sev: 'mute' }
  return { labelKey: `${keyPrefix}.${code}`, sev: map[code as K] }
}

/**
 * A state's badge: its `sync-console` label key and its severity.
 *
 * An unknown state (a door newer than this bundle) is **neutral** and has no key —
 * the caller shows the raw code rather than inventing a word for it.
 */
export function stateBadge(state: string): CodeBadge {
  return codeBadge(STATE_SEVERITY, 'states', state)
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

/** The door's sorts; the mirror rail's two (2563) are appended after the store worker's four. */
export const FLEET_SORTS: readonly FleetSort[] = [
  'mostBehind',
  'longestOffline',
  'newestError',
  'code',
  'largestBacklog',
  'mostDeadLetters',
]

export const DEFAULT_FLEET_FILTER: FleetFilter = {
  states: [],
  host: null,
  q: '',
  sort: 'mostBehind',
  page: 1,
}

/** A tile: `all`, or one state. */
export type FleetTile = 'all' | StoreState

/**
 * `all` and a tile per state, in the contract's order. 🚩 `railsDisagree` is held out of
 * the row: its tile belongs to rail agreement (ticket 459), not to the mirror lane.
 */
export const FLEET_TILES: readonly FleetTile[] = ['all', ...STORE_STATES.filter((s) => s !== 'railsDisagree')]

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

// Since 2563 the card passes the store sync worker's items only (`workerCardItems`):
// each mirror role carries its own banner, and "none has reported" keys on the store worker.
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

// ── The mirror lane chip (spec 2563, ticket 456) ────────────────────────────────

/** Worse first: the chip takes the state that ranks highest here. */
const SEVERITY_RANK: Record<Severity, number> = { bad: 4, warn: 3, go: 2, ok: 1, mute: 0 }

/**
 * A row's mirror lane as the one compact chip draws it.
 *
 * - `notOnMirror`: no swept location. Muted, and it carries **no** state, even if one
 *   arrived on the row.
 * - `onMirror`: coloured by the worst mirror-set state on the row (`states[]`, the
 *   door's — never derived here); with none of them it is healthy (`go`). A tie keeps
 *   the contract's order. `railsDisagree` is not a lane state, and any other state is
 *   not the lane's either.
 *
 * `tillBacklogCount` stays `null` when it was never measured, so the chip can say so
 * rather than draw a `0` that reads as "nothing waiting".
 */
export type MirrorLaneChip =
  | { kind: 'notOnMirror'; sev: 'mute' }
  | {
      kind: 'onMirror'
      sev: Severity
      /** The worst mirror state, `null` when the lane is healthy. */
      worst: MirrorState | null
      tillBacklogCount: number | null
      inboxPending: number
      openDeadLetters: number
    }

export function mirrorLaneChip(row: Pick<StoreRow, 'mirror' | 'states'>): MirrorLaneChip {
  // `=== true` and nothing looser: a lane the door did not send is not one to colour.
  if (row.mirror?.onMirror !== true) return { kind: 'notOnMirror', sev: 'mute' }
  let worst: MirrorState | null = null
  for (const s of MIRROR_STATES.filter((m) => row.states.includes(m))) {
    if (worst === null || SEVERITY_RANK[stateBadge(s).sev] > SEVERITY_RANK[stateBadge(worst).sev]) worst = s
  }
  return {
    kind: 'onMirror',
    sev: worst === null ? 'go' : stateBadge(worst).sev,
    worst,
    tillBacklogCount: row.mirror.tillBacklogCount,
    inboxPending: row.mirror.inboxPending,
    openDeadLetters: row.mirror.openDeadLetters,
  }
}

// ── The worker card's items (spec 2563, ticket 456) ─────────────────────────────

const TICK_SEVERITY: Record<MirrorTickOutcome, Severity> = {
  Swept: 'ok',
  Applied: 'ok',
  // Another instance holds the lock: that one is working, so this is quiet, not idle.
  SkippedLockHeld: 'mute',
  // 🚩 The inbox is full and the pull stopped — a warning, never idle.
  SkippedBackpressure: 'warn',
  Faulted: 'bad',
  None: 'mute',
}

/** A mirror tick outcome's badge; an outcome this bundle does not know shows its raw code. */
export function tickOutcomeBadge(outcome: string): CodeBadge {
  return codeBadge(TICK_SEVERITY, 'tickOutcomes', outcome)
}

/** A mirror role on the worker card: the worker, its outcome badge and its own stale flag. */
export interface MirrorCardItem {
  worker: MirrorWorker
  outcome: CodeBadge
  /** The door's `isStale` and nothing else: the item's own red banner. */
  stale: boolean
}

export interface WorkerCardItems {
  /** The store sync worker's items, as the card drew them before 2563. */
  store: SyncWorker[]
  /** The mirror roles: every Mirror pull, then every Mirror apply, each in the door's order. */
  mirror: MirrorCardItem[]
}

const MIRROR_RAILS = ['mirrorPull', 'mirrorApply'] as const

/**
 * `Workers` items narrowed on `rail`. A mirror role absent from the items draws
 * nothing (a missing mirror table reads as no data), and an item whose `rail` this
 * bundle does not know is left out, since its shape cannot be told.
 */
export function workerCardItems(items: readonly WorkerItem[]): WorkerCardItems {
  const store = items.filter((w): w is SyncWorker => w.rail === 'store')
  const mirror = MIRROR_RAILS.flatMap((rail) =>
    items
      .filter((w): w is MirrorWorker => w.rail === rail)
      .map((worker) => ({ worker, outcome: tickOutcomeBadge(worker.lastTickOutcome), stale: worker.isStale === true })),
  )
  return { store, mirror }
}
