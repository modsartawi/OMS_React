/**
 * The console's reads, filled where a door has not shipped spec 2563 yet (ticket 456).
 *
 * 🚩 The model matches the contract exactly, but the live console still meets the OLD
 * doors until BackOffice 2564–2567 are deployed (450's staging walk is on them). So
 * each read fills a member the door did not send, at the boundary, and nothing past
 * `api.ts` ever sees a half shape:
 *
 * - no `mirror` → a not-on-mirror lane (`onMirror: false`, nulls and zeros);
 * - no `agreement` → `notJudged`;
 * - no `rail` on a worker → `store` (the only worker an old door knows);
 * - no `mirror` on an hour → `noData` with zeros;
 * - no mirror totals on the last hour → zeros.
 *
 * Only a MISSING member is filled. A member the door did send is passed through as it
 * is, and no state is derived here: states stay the door's.
 */
import {
  MIRROR_HOUR_TOTALS,
  type FleetLastHour,
  type HourTotals,
  type MirrorHour,
  type MirrorHourTotal,
  type MirrorLane,
  type MirrorWorker,
  type Paged,
  type StoreDetail,
  type StoreHour,
  type StoreHours,
  type StoreRow,
  type SyncWorker,
  type SyncWorkers,
  type WorkerItem,
} from '@/core/models/sync-console'

/** A member a pre-2563 door leaves out. */
type Pre2563<T, K extends keyof T> = Omit<T, K> & { [P in K]?: T[P] | null }

/** The lane of a store the mirror rail does not sweep — what the contract sends for one. */
export const notOnMirrorLane = (): MirrorLane => ({
  onMirror: false,
  lastPullAt: null,
  lastPullOkAt: null,
  lastConnectOkAt: null,
  lastConnectFailAt: null,
  lastConnectError: null,
  tillBacklogCount: null,
  tillBacklogOldestAt: null,
  inboxPending: 0,
  inboxDeferred: 0,
  oldestDeferredAt: null,
  openDeadLetters: 0,
})

export type WireStoreRow = Pre2563<StoreRow, 'mirror' | 'agreement'>

export type WireStoreDetail = Pre2563<StoreDetail, 'mirror' | 'agreement'>

/** A fleet row or the store header (`StoreDetail` keeps its own members). */
export function withMirrorLane<T extends WireStoreRow>(row: T): Omit<T, 'mirror' | 'agreement'> & Pick<StoreRow, 'mirror' | 'agreement'> {
  return { ...row, mirror: row.mirror ?? notOnMirrorLane(), agreement: row.agreement ?? 'notJudged' }
}

/** `GET ActionSync/Fleet`. */
export function normaliseFleet(page: Paged<WireStoreRow>): Paged<StoreRow> {
  return { ...page, items: page.items.map(withMirrorLane) }
}

type WireWorker = Pre2563<SyncWorker, 'rail'> | MirrorWorker

export type WireWorkers = { items: WireWorker[] }

/** `GET ActionSync/Workers`: an item with no `rail` is the store sync worker. */
export function normaliseWorkers(data: WireWorkers): SyncWorkers {
  return { ...data, items: data.items.map((w): WorkerItem => (w.rail == null ? { ...w, rail: 'store' } : (w as WorkerItem))) }
}

/** A row-less mirror hour, as the contract sends one. */
export const noMirrorHour = (): MirrorHour => ({
  cell: 'noData',
  sweeps: 0,
  connectFailures: 0,
  rowsPulled: 0,
  applied: 0,
  deferred: 0,
  errored: 0,
  deadLettered: 0,
})

export type WireStoreHours = { items: Pre2563<StoreHour, 'mirror'>[] }

/** `GET ActionSync/Store/Hours`. */
export function normaliseStoreHours(data: WireStoreHours): StoreHours {
  return { ...data, items: data.items.map((h) => ({ ...h, mirror: h.mirror ?? noMirrorHour() })) }
}

type WireHourTotals = Pre2563<HourTotals, MirrorHourTotal>

function withMirrorTotals(hour: WireHourTotals): HourTotals {
  const filled = { ...hour } as HourTotals
  for (const k of MIRROR_HOUR_TOTALS) filled[k] = hour[k] ?? 0
  return filled
}

export type WireLastHour = { current: WireHourTotals; previous: WireHourTotals }

/** `GET ActionSync/Fleet/LastHour`. */
export function normaliseLastHour(data: WireLastHour): FleetLastHour {
  return { ...data, current: withMirrorTotals(data.current), previous: withMirrorTotals(data.previous) }
}
