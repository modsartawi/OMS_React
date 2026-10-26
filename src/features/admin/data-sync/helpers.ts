/**
 * The Data sync screen's pure logic (spec 558; ticket 559 lands the campaigns page's). No React,
 * no network — each one is pinned by `helpers.test.ts`.
 *
 * 🚩 **States come from the door.** Nothing here decides a campaign's status; the badge only
 * names and colours what the door said.
 */
import { ApiError } from '@/core/api'
import type { Severity } from '@/core/ui/severity'
import {
  CAMPAIGN_STATUSES,
  DATA_SYNC_PAGE_SIZE,
  type CampaignStatus,
  type CampaignsQuery,
  type DataSyncHealth,
} from '@/core/models/data-sync'

/** The campaigns list refetches every 30 s (spec 558). */
export const CAMPAIGNS_REFRESH_MS = 30_000

/**
 * A count with its digits grouped, `12,345` — the one spelling of every number the screen draws.
 * (Not core's `formatNumber`, which does not group.) Locale templates take it as `{{figure}}`.
 */
export const groupDigits = (n: number): string => n.toLocaleString('en-US')

// ── Code → label + severity ─────────────────────────────────────────────────────

/** A machine code's badge: its label key, or `null` for a code this bundle does not know. */
export type CodeBadge = { labelKey: string | null; sev: Severity }

/**
 * The one "code → label + severity" lookup every badge of the screen reads. A code missing from
 * the map (a door newer than this bundle, or a key inherited from `Object.prototype`) is
 * **neutral with no key**, so the caller shows the raw code rather than inventing a word.
 */
export function codeBadge<K extends string>(map: Record<K, Severity>, keyPrefix: string, code: string): CodeBadge {
  if (!Object.hasOwn(map, code)) return { labelKey: null, sev: 'mute' }
  return { labelKey: `${keyPrefix}.${code}`, sev: map[code as K] }
}

const CAMPAIGN_STATUS_SEVERITY: Record<CampaignStatus, Severity> = {
  Ready: 'mute', // created, waiting for a person to press Start
  Running: 'go',
  Pausing: 'go',
  Paused: 'warn', // held until a person resumes it
  Cancelling: 'go',
  Cancelled: 'bad',
  Completed: 'ok',
}

/** A campaign status's badge (`data-sync:campaignStatus.*`). */
export function campaignStatusBadge(status: string): CodeBadge {
  return codeBadge(CAMPAIGN_STATUS_SEVERITY, 'campaignStatus', status)
}

// ── The campaigns query and its URL ─────────────────────────────────────────────

/** What the campaigns grid is asked for. Kept in the URL (`?status=&page=`). */
export interface CampaignsFilter {
  status: CampaignStatus | null
  page: number
}

export const DEFAULT_CAMPAIGNS_FILTER: CampaignsFilter = { status: null, page: 1 }

/** The door's query: the status by its exact (case-sensitive) name, the page, 50 a page. */
export function campaignsQuery(filter: CampaignsFilter): CampaignsQuery {
  return { status: filter.status, page: filter.page, pageSize: DATA_SYNC_PAGE_SIZE }
}

const isCampaignStatus = (v: string): v is CampaignStatus => (CAMPAIGN_STATUSES as readonly string[]).includes(v)

/** A page from the address: a positive whole number, else 1. */
function pageFromParam(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/**
 * The filter read from the address. An unknown status is dropped rather than sent: the door
 * refuses one with a 400 (and matches names case-sensitively).
 */
export function campaignsFilterFromParams(params: URLSearchParams): CampaignsFilter {
  const status = params.get('status') ?? ''
  return { status: isCampaignStatus(status) ? status : null, page: pageFromParam(params.get('page')) }
}

/** The filter written to the address — only what differs from the default. */
export function campaignsFilterToParams(filter: CampaignsFilter): URLSearchParams {
  const out = new URLSearchParams()
  if (filter.status) out.set('status', filter.status)
  if (filter.page > 1) out.set('page', String(filter.page))
  return out
}

// ── Paging without a total ──────────────────────────────────────────────────────

/**
 * The DataSync list doors return a plain array with no total, so the one thing known is whether
 * this page came back full: Next is offered only then. (A full last page offers one Next onto an
 * empty page — the price of a door with no total.)
 */
export function nextEnabledOnFullPage(rowCount: number, pageSize: number): boolean {
  return rowCount >= pageSize
}

// ── The service banner ──────────────────────────────────────────────────────────

/** A worker that has not ticked for longer than this reads as stalled (spec 558: "over a minute"). */
export const WORKER_STALE_MS = 60_000

export type ServiceBanner =
  | { kind: 'stateDbUnreachable' }
  | { kind: 'workerDisabled' }
  /** `lastTick` null: an enabled worker that has never ticked. */
  | { kind: 'workerStale'; lastTick: string | null }

/**
 * What the banner says, from the `DataSync/Health` read — so a stalled campaign never looks like
 * a slow one. Worst first: an unreachable state DB, then a worker turned off, then a worker whose
 * last tick is over a minute old (`now` passed in, for the tests).
 *
 * ⚠ A 503 is how the door says the state DB is unreachable, and `core/api` throws on it (an
 * enveloped `success:false` with no code → a `server` ApiError, data dropped). So the banner keys
 * on the error's STATUS. It wins over a cached healthy answer, which is older than the failure.
 * Any other failure (network, a 500) is not guessed at: no banner.
 */
export function serviceBanner(
  read: { health: DataSyncHealth | undefined; error: unknown },
  now: number,
): ServiceBanner | null {
  if (read.error instanceof ApiError && read.error.statusCode === 503) return { kind: 'stateDbUnreachable' }
  const h = read.health
  if (!h) return null
  if (h.stateDb === 'Unreachable') return { kind: 'stateDbUnreachable' }
  if (!h.workerEnabled) return { kind: 'workerDisabled' }
  if (h.lastWorkerTick == null) return { kind: 'workerStale', lastTick: null }
  const tick = Date.parse(h.lastWorkerTick)
  if (Number.isFinite(tick) && now - tick > WORKER_STALE_MS) return { kind: 'workerStale', lastTick: h.lastWorkerTick }
  return null
}
