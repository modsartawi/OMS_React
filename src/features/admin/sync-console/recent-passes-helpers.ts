/**
 * The Recent passes page's pure logic: the filter, its door parameters, each pass
 * kind's badge, and the window's mix as the bar draws it. No React, no network —
 * pinned by `recent-passes-helpers.test.ts`.
 *
 * 🚩 **Kinds come from the door.** Nothing here reads an error text; `passKindBadge`
 * only names and colours the `kind` the door classed the row as.
 */
import type { Severity } from '@/core/ui/severity'
import { PASS_KINDS, type PassKind, type RecentPassesSummary, type SyncLoop } from '@/core/models/sync-console'
import { codeBadge, type CodeBadge } from './helpers'

export const RECENT_PASSES_PAGE_SIZE = 50

/** The windows offered, in minutes; the door takes 5 to 1440 and defaults to 60. */
export const RECENT_WINDOWS = [15, 60, 180, 720, 1440] as const
export type RecentWindow = (typeof RECENT_WINDOWS)[number]

export interface RecentPassesFilter {
  minutes: RecentWindow
  loop: SyncLoop | null
  /** One kind, or every kind. */
  kind: PassKind | null
  /** An exact store code; blank = every store. */
  code: string
  page: number
}

export const DEFAULT_RECENT_PASSES_FILTER: RecentPassesFilter = { minutes: 60, loop: null, kind: null, code: '', page: 1 }

/** The `GET ActionSync/Passes` parameters; `@/core/api` drops the nulls and the blank code. */
export function recentPassesQuery(filter: RecentPassesFilter): Record<string, unknown> {
  return {
    minutes: filter.minutes,
    loop: filter.loop,
    kind: filter.kind,
    code: filter.code.trim(),
    page: Math.max(1, Math.floor(filter.page)),
    pageSize: RECENT_PASSES_PAGE_SIZE,
  }
}

/**
 * A kind's severity: `ok` went well, `running` is in motion, a store that could not
 * be reached is the network's red, a deadline or a timeout is a slow store's amber,
 * a failed chunk or an unmatched error needs a look, a restart's row is noise.
 */
const KIND_SEVERITY: Record<PassKind, Severity> = {
  ok: 'ok',
  running: 'go',
  connect: 'bad',
  deadline: 'warn',
  timeout: 'warn',
  chunk: 'warn',
  restart: 'mute',
  other: 'bad',
}

export function passKindBadge(kind: string): CodeBadge {
  return codeBadge(KIND_SEVERITY, 'passKinds', kind)
}

/** What clicking a kind tile does: choose it, or clear it when it is the one chosen. */
export function toggleKind(filter: RecentPassesFilter, kind: PassKind): RecentPassesFilter {
  return { ...filter, kind: filter.kind === kind ? null : kind, page: 1 }
}

/** One segment of the mix bar: a kind, its count and its share of the window, in whole percent. */
export interface MixSegment {
  kind: PassKind
  count: number
  percent: number
}

/** The window's kinds that happened, in the contract's order, with their share; none when the window is empty. */
export function passMix(summary: RecentPassesSummary): MixSegment[] {
  if (summary.passes <= 0) return []
  return PASS_KINDS.filter((k) => (summary.kinds[k] ?? 0) > 0).map((kind) => ({
    kind,
    count: summary.kinds[kind],
    percent: Math.round((100 * summary.kinds[kind]) / summary.passes),
  }))
}

/**
 * The headline: the share of FINISHED passes that went well (a running pass has not
 * ended either way), and the share of stores reached by their last connect. `null`
 * when there is nothing to judge.
 */
export function okShare(summary: RecentPassesSummary): number | null {
  const finished = summary.passes - (summary.kinds.running ?? 0)
  return finished > 0 ? Math.round((100 * (summary.kinds.ok ?? 0)) / finished) : null
}

export function reachShare(summary: RecentPassesSummary): number | null {
  const tried = summary.reachedStores + summary.unreachedStores
  return tried > 0 ? Math.round((100 * summary.reachedStores) / tried) : null
}

/** A share's severity: 90 % and up is green, 70 % and up amber, below that red. */
export function shareSeverity(percent: number | null): Severity {
  if (percent === null) return 'mute'
  return percent >= 90 ? 'ok' : percent >= 70 ? 'warn' : 'bad'
}
