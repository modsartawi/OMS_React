import type { DeliverectStoreRow } from '@/core/models/deliverect'
import type { Severity } from '@/core/ui/severity'

// A Deliverect store's stock sync health (spec 2615, ticket 480): the rule behind the store grid's
// highlight (precedent: HungerStation spec 1872) and the log drawer's run labels. Pure: no React,
// no `t`.

// ── The cadence (spec 2615 "Cadence": a full sync once a day after 07:00, otherwise a delta at
// least 30 minutes after the previous run). Owner-overrulable thresholds (HITL-480). ──────────

/** The full sync is due once a day after this local hour. */
export const FULL_SYNC_HOUR = 7
/** …and is overdue once this many minutes past it have gone by with no full run today (07:30). */
export const FULL_SYNC_GRACE_MINUTES = 30
/** No run of either kind in this many minutes is overdue — twice the 30-minute delta cadence. */
export const DELTA_OVERDUE_MINUTES = 60

/**
 * - `ok` — the last run succeeded and nothing is overdue;
 * - `failed` — the last run's status is anything but `"S"`, on an active sync (red);
 * - `overdue` — a linked, active store is behind the cadence (amber);
 * - `paused` — the sync is paused: never overdue or failed, no highlight;
 * - `notRun` — no run recorded and not (yet) behind: neutral.
 */
export type SyncHealth = 'ok' | 'failed' | 'overdue' | 'paused' | 'notRun'

export interface SyncHealthReading {
  health: SyncHealth
  /** No full run since today's 07:00, and it is past 07:30. */
  fullOverdue: boolean
  /** No run of either kind in the last {@link DELTA_OVERDUE_MINUTES} minutes. */
  deltaOverdue: boolean
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/

/**
 * A contract time (`"yyyy-MM-ddTHH:mm:ss"`, local wall-clock, no offset) as a local `Date`, built
 * from its parts so no engine ever reads it as UTC. `null` when absent or unreadable.
 */
export function parseLocal(value: string | null | undefined): Date | null {
  const m = value ? LOCAL.exec(value) : null
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0))
}

/** `"S"` is success; the contract enumerates nothing else, so any other non-null value is a failure. */
export function runFailed(status: string | null | undefined): boolean {
  return status != null && status !== 'S'
}

/**
 * The store's sync health at `now`, or `null` when the row carries no `sync` block (2624 not
 * shipped). Precedence: a paused store is `paused` — never overdue and never red, even when its last
 * run failed (a store is often paused BECAUSE its stock is bad, spec 2615 story 27; the last status
 * column still shows the code); then a failed last run is `failed`; then a linked store behind the
 * cadence is `overdue`. A store Deliverect has not linked yet is never overdue — the worker only
 * syncs linked stores — and a store linked in the last {@link DELTA_OVERDUE_MINUTES} minutes is
 * given that long for its first run.
 */
export function syncHealth(
  row: Pick<DeliverectStoreRow, 'sync' | 'deliverectLocationId'> & Partial<Pick<DeliverectStoreRow, 'linkedAt'>>,
  now: Date,
): SyncHealthReading | null {
  const sync = row.sync
  if (!sync) return null
  const none = { fullOverdue: false, deltaOverdue: false }
  if (!sync.active) return { health: 'paused', ...none }
  if (runFailed(sync.lastStatus)) return { health: 'failed', ...none }

  // Linked, and past the grace a freshly linked store gets for its first run.
  const linkedAt = parseLocal(row.linkedAt)
  const settled = linkedAt === null || now.getTime() - linkedAt.getTime() > DELTA_OVERDUE_MINUTES * 60_000
  const linked = row.deliverectLocationId != null && settled
  const full = parseLocal(sync.lastFullRun)
  const delta = parseLocal(sync.lastDeltaRun)

  const dueAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), FULL_SYNC_HOUR, 0, 0)
  const overdueAt = new Date(dueAt.getTime() + FULL_SYNC_GRACE_MINUTES * 60_000)
  const fullOverdue = linked && now > overdueAt && (full === null || full < dueAt)

  // The latest run of EITHER kind: a delta runs 30 minutes after the previous run, full or delta.
  const latest = Math.max(full?.getTime() ?? -Infinity, delta?.getTime() ?? -Infinity)
  const deltaOverdue = linked && now.getTime() - latest > DELTA_OVERDUE_MINUTES * 60_000

  if (fullOverdue || deltaOverdue) return { health: 'overdue', fullOverdue, deltaOverdue }
  return { health: sync.lastStatus == null ? 'notRun' : 'ok', ...none }
}

/** The highlight a health gives its row and badge: red for failed, amber for overdue, else none. */
export function syncHighlight(health: SyncHealth): Extract<Severity, 'bad' | 'warn'> | null {
  return health === 'failed' ? 'bad' : health === 'overdue' ? 'warn' : null
}

/** A log row's `syncType` as a label key — `F` full, `D` delta — or `null` for a value the contract does not name. */
export function syncTypeKey(syncType: string): 'full' | 'delta' | null {
  return syncType === 'F' ? 'full' : syncType === 'D' ? 'delta' : null
}
