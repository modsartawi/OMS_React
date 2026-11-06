import type { SlotConvergence, SlotOutcomeFilter, SlotQueueEntry } from '@/core/models/release-queue'
import { skipForPage } from '@/core/ui/pager'
import { formatCount } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'

// The release download queue's pure rules (ticket 791, BackOffice spec 3396). No React, no i18n.

/** Four hours, in seconds: a wait this long is a stuck till or a too-small pool (spec 3396 story 36). */
export const FOUR_HOURS_SECONDS = 4 * 60 * 60

/**
 * Whether a queued till's wait is flagged: four hours or more by its own seconds, or flagged by HQ. HQ's
 * `waitedOverFourHours` is read too because its clock is the one that counted the wait.
 */
export function fourHourFlag(entry: Pick<SlotQueueEntry, 'waitSeconds' | 'waitedOverFourHours'>): boolean {
  return entry.waitedOverFourHours === true || entry.waitSeconds >= FOUR_HOURS_SECONDS
}

/**
 * A queued till's place as one machine value, `position / queue length` (`3 / 12`), digits grouped. Built by
 * `formatCount` so it is isolated once, whole (`.claude/rules/bidi.md`).
 */
export function queuePositionLabel(position: number, queueLength: number): string {
  return formatCount(formatFigure(position), formatFigure(queueLength))
}

/** One release's spread: the tills it touches, and each state's whole-percent share of them. */
export interface ConvergenceShares {
  total: number
  downloaded: number
  downloading: number
  waiting: number
}

const STATES = ['downloaded', 'downloading', 'waiting'] as const

/**
 * A release's downloaded / downloading / waiting as whole percents of the tills it touches, rounded by largest
 * remainder so the three always add up to 100 (a bar drawn from them never overshoots or leaves a gap). A version
 * no till touches is all zeros.
 */
export function convergenceShares(row: Pick<SlotConvergence, 'downloaded' | 'downloading' | 'waiting'>): ConvergenceShares {
  const counts = STATES.map((s) => Math.max(0, row[s] || 0))
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return { total: 0, downloaded: 0, downloading: 0, waiting: 0 }
  const exact = counts.map((c) => (c * 100) / total)
  const shares = exact.map(Math.floor)
  let left = 100 - shares.reduce((a, b) => a + b, 0)
  // Largest remainder first; ties go to the earlier state, so the answer is stable.
  const byRemainder = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (const { i } of byRemainder) {
    if (left <= 0) break
    shares[i] += 1
    left -= 1
  }
  return { total, downloaded: shares[0], downloading: shares[1], waiting: shares[2] }
}

/** A wait or a duration (whole seconds, HQ's) as `h:mm:ss`, hours uncapped. Negative or non-numeric is blank. */
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  const s = Math.floor(seconds)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** A finished lease's state as the page names it (the `history.outcome.*` keys). */
export type OutcomeKind = 'done' | 'failed' | 'expired' | 'freed' | 'unknown'

const OUTCOMES: Record<string, OutcomeKind> = {
  'released-done': 'done',
  'released-failed': 'failed',
  expired: 'expired',
  'freed-by-hand': 'freed',
}

export function outcomeKind(outcome: string): OutcomeKind {
  return OUTCOMES[outcome] ?? 'unknown'
}

/** The History tab's filters and page (1-based). */
export interface HistoryFilter {
  /** '' = every outcome. */
  outcome: SlotOutcomeFilter | ''
  store: string
  version: string
  page: number
}

export const HISTORY_PAGE_SIZE = 50

/** `GET PosReleaseQueue/History`'s query: the filters trimmed, the page as skip / take. */
export function historyParams(f: HistoryFilter, take: number) {
  return {
    outcome: f.outcome,
    store: f.store.trim(),
    version: f.version.trim(),
    skip: skipForPage(f.page, take),
    take,
  }
}

/** The page's four panels, in the order the tab strip draws them. */
export const RELEASE_QUEUE_TABS = ['slots', 'queue', 'history', 'convergence'] as const
export type ReleaseQueueTab = (typeof RELEASE_QUEUE_TABS)[number]

/** The History filter's choices (the door's short outcome forms). */
export const OUTCOME_FILTERS: readonly SlotOutcomeFilter[] = ['done', 'failed', 'expired', 'freed-by-hand']

/** What the page keeps in its address: the open tab and the History filters. */
export interface ReleaseQueueQuery {
  tab: ReleaseQueueTab
  history: HistoryFilter
}

export function releaseQueueFromParams(params: URLSearchParams): ReleaseQueueQuery {
  const tab = params.get('tab') as ReleaseQueueTab | null
  const outcome = params.get('outcome') as SlotOutcomeFilter | null
  const page = Number(params.get('page'))
  return {
    tab: tab && RELEASE_QUEUE_TABS.includes(tab) ? tab : 'slots',
    history: {
      outcome: outcome && OUTCOME_FILTERS.includes(outcome) ? outcome : '',
      store: params.get('store') ?? '',
      version: params.get('version') ?? '',
      page: Number.isInteger(page) && page > 1 ? page : 1,
    },
  }
}

export function releaseQueueToParams(q: ReleaseQueueQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (q.tab !== 'slots') p.set('tab', q.tab)
  if (q.history.outcome) p.set('outcome', q.history.outcome)
  if (q.history.store) p.set('store', q.history.store)
  if (q.history.version) p.set('version', q.history.version)
  if (q.history.page > 1) p.set('page', String(q.history.page))
  return p
}

/** One store in the queue, at its first till's place, with its waiting tills in position order. */
export interface QueuedStore {
  storeCode: string
  tills: SlotQueueEntry[]
}

/** The queue as stores in grant order: each store once, where its first till stands. */
export function storesInGrantOrder(entries: readonly SlotQueueEntry[]): QueuedStore[] {
  const stores = new Map<string, QueuedStore>()
  for (const e of [...entries].sort((a, b) => a.position - b.position)) {
    const store = stores.get(e.storeCode) ?? { storeCode: e.storeCode, tills: [] }
    store.tills.push(e)
    stores.set(e.storeCode, store)
  }
  return [...stores.values()]
}
