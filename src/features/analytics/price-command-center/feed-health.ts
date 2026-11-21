/**
 * The Feed health tab's rules (oms 939, BackOffice spec 4127 decision 8): which runs a competitor shows per price
 * source, what state each run is in, and the confirmed authority change. ⚠ The per-source runs ride BO 4131's GUESSED `runsBySource`; a server before
 * 4131 sends only `lastRun`, of no stated source, and that one run is shown as such.
 */
import type { TFunction } from 'i18next'
import {
  PRICE_SOURCES,
  type FeedHealthCompetitor,
  type FeedRunSummary,
  type FeedSourceRun,
  type PriceSource,
  type PriceWatchCompetitorSetting,
} from '@/core/models/price-watch'
import { confirmAction } from '@/core/services/confirm'
import { fsi } from '@/core/util/bidi'
import { priceFeedHealthApi } from './api'

/** One row of a competitor's runs: a source (null = the server did not say) and its latest run (null = never ran). */
export interface SourceRunRow {
  source: PriceSource | null
  run: (FeedRunSummary & Partial<Pick<FeedSourceRun, 'errorMessage' | 'isQuotaOrAuthError'>>) | null
}

/** A competitor's runs, one row per price source in `PRICE_SOURCES` order (a source that never ran there included). */
export function sourceRuns(competitor: FeedHealthCompetitor): SourceRunRow[] {
  const bySource = competitor.runsBySource
  if (!bySource) return [{ source: null, run: competitor.lastRun }]
  return PRICE_SOURCES.map((source) => ({ source, run: bySource.find((r) => r.source === source)?.lastRun ?? null }))
}

/** A percentage to one decimal: `22.8 %`. One machine value — isolate it whole. */
export function formatPercent(value: number): string {
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

/**
 * 🔀 The material drill-down's address (oms 936, built in parallel). 936 provides the link helper; until the merge a
 * cross-check material links here, and this ONE function is what the merge swaps for 936's.
 */
export function materialHref(material: string): string {
  return `/analytics/price-command-center?${new URLSearchParams({ material }).toString()}`
}

/**
 * The confirmation that names what an authority change does: "Mindsite's prices will count for Panda; our scraper's will
 * not." Every interpolated value is `fsi()`-isolated whole (a `t()` sentence is a string-only sink — the bidi rule).
 */
export function authorityChangeMessage(t: TFunction, competitor: FeedHealthCompetitor, to: PriceSource): string {
  const from = competitor.authoritativeSource ?? PRICE_SOURCES.find((s) => s !== to) ?? to
  return t('feedHealth.change.message', {
    to: fsi(t(`feedHealth.change.whose.${to}`)),
    from: fsi(t(`feedHealth.change.other.${from}`)),
    competitor: fsi(competitor.name || competitor.competitorCode),
  })
}

/**
 * Change a competitor's authoritative price source (⚠ GUESSED door, BO 4128): asks on the core confirm dialog first, and
 * sends the setting only once confirmed. Resolves the new setting, or null when nothing was sent (cancelled, or the
 * source picked already counts). A refusal rejects with the `ApiError`, for the caller to show.
 */
export async function requestAuthorityChange(t: TFunction, competitor: FeedHealthCompetitor, to: PriceSource): Promise<PriceWatchCompetitorSetting | null> {
  if (competitor.authoritativeSource === to) return null
  if (!(await confirmAction(authorityChangeMessage(t, competitor, to), t('feedHealth.change.header')))) return null
  return priceFeedHealthApi.setAuthority(competitor.competitorCode, to)
}

export const RUN_STATES = ['never', 'running', 'blocked', 'quotaOrAuth', 'failures', 'ok'] as const
export type RunState = (typeof RUN_STATES)[number]

/** What a run says at a glance — a quota or auth refusal before a block, a block before a run still going. */
export function runState(run: SourceRunRow['run']): RunState {
  if (run === null) return 'never'
  if (run.isQuotaOrAuthError) return 'quotaOrAuth'
  if (run.isBlocked) return 'blocked'
  if (run.finishedAt === null) return 'running'
  if (run.failures > 0) return 'failures'
  return 'ok'
}
