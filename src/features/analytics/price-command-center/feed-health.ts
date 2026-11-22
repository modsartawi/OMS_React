/**
 * The Feed health tab's rules (oms 939, BackOffice spec 4127 decision 8): which runs a competitor shows per price
 * source, what state each run is in, and the confirmed authority change. BO 4131 as shipped (pricing2 d099aac36): the
 * per-source runs are `lastRunBySource` (the latest run of each source that ever ran there, each with its `source` and
 * `errorMessage`); a source that never ran is absent from it.
 */
import type { TFunction } from 'i18next'
import {
  PRICE_SOURCES,
  type FeedHealthCompetitor,
  type FeedRunSummary,
  type PriceSource,
  type PriceWatchCompetitorAuthority,
} from '@/core/models/price-watch'
import { confirmAction } from '@/core/services/confirm'
import { fsi } from '@/core/util/bidi'
import { priceFeedHealthApi } from './api'

/** One row of a competitor's runs: a source and its latest run (null = that source never ran there). */
export interface SourceRunRow {
  source: PriceSource
  run: FeedRunSummary | null
}

/** A competitor's runs, one row per price source in `PRICE_SOURCES` order (a source that never ran there included). */
export function sourceRuns(competitor: FeedHealthCompetitor): SourceRunRow[] {
  const bySource = competitor.lastRunBySource ?? []
  return PRICE_SOURCES.map((source) => ({ source, run: bySource.find((r) => r.source === source) ?? null }))
}

/** A percentage to one decimal: `22.8 %`. One machine value — isolate it whole. */
export function formatPercent(value: number): string {
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
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
 * Change a competitor's authoritative price source (`PUT PriceWatch/Competitors/{competitor}/Authority`, BO 4128): asks on the core confirm dialog first, and
 * sends the setting only once confirmed. Resolves the new setting, or null when nothing was sent (cancelled, or the
 * source picked already counts). A refusal rejects with the `ApiError`, for the caller to show.
 */
export async function requestAuthorityChange(t: TFunction, competitor: FeedHealthCompetitor, to: PriceSource): Promise<PriceWatchCompetitorAuthority | null> {
  if (competitor.authoritativeSource === to) return null
  if (!(await confirmAction(authorityChangeMessage(t, competitor, to), t('feedHealth.change.header')))) return null
  return priceFeedHealthApi.setAuthority(competitor.competitorCode, to)
}

export const RUN_STATES = ['never', 'running', 'blocked', 'error', 'failures', 'ok'] as const
export type RunState = (typeof RUN_STATES)[number]

/**
 * What a run says at a glance — an error (BO 4131's `errorMessage`, e.g. a Mindsite quota or auth refusal; the wire has
 * no separate quota flag) before a block, a block before a run still going.
 */
export function runState(run: SourceRunRow['run']): RunState {
  if (run === null) return 'never'
  if (run.errorMessage?.trim()) return 'error'
  if (run.isBlocked) return 'blocked'
  if (run.finishedAt === null) return 'running'
  if (run.failures > 0) return 'failures'
  return 'ok'
}
