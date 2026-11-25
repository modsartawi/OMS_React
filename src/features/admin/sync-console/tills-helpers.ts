/**
 * The Tills view's pure logic (spec 4288, BackOffice 4290). No React, no network: pinned by `tills-helpers.test.ts`.
 *
 * 🚩 **The verdict is the till's.** Each till judges its own links over a rolling window and reports the result; the
 * console only names and colours it. The one thing decided here is **silence**: a till that stopped reporting is never
 * drawn with its last verdict as if it were current — a stale last-seen beats an old "online".
 *
 * Every time is judged against the door's `asOf` (the server's clock), never the browser's.
 */
import type { Severity } from '@/core/ui/severity'
import type { LinkHour, LinkState, LinkVerdict, StoreRow, Till, TillHour } from '@/core/models/sync-console'
import { codeBadge } from './helpers'

/**
 * A till reports with its presence stamp, about once a minute; one missed beat is noise, three is silence. Past this, a
 * verdict is history, not news.
 */
export const TILL_SILENT_AFTER_MS = 3 * 60_000

const LINK_SEVERITY: Record<LinkState, Severity> = {
  online: 'ok',
  unstable: 'warn',
  offline: 'bad',
  unknown: 'mute',
  local: 'mute',
}

/** The dot beside a cell's words, one token class per severity (the palette lint refuses literals). */
export const LINK_DOT: Record<Severity, string> = {
  ok: 'bg-success',
  go: 'bg-primary',
  warn: 'bg-attention',
  bad: 'bg-danger',
  mute: 'bg-muted-foreground/40',
}

export type TillLinkFigures = { failPct: number | null; slowPct: number | null; p95Ms: number | null }

/**
 * One link cell:
 * - `verdict` — the till's current judgement (`labelKey` null for a state this bundle does not know: show the code);
 * - `silent` — the till stopped reporting; `state` is the last verdict it sent, for the sub-line only;
 * - `noData` — the link was never reported (an older build, or the store link before 4291).
 */
export type TillLinkCell = {
  kind: 'verdict' | 'silent' | 'noData'
  labelKey: string | null
  sev: Severity
  state: LinkState | null
  figures: TillLinkFigures | null
  since: string | null
}

/** A wire time (`yyyy-MM-ddTHH:mm:ss`, local, no offset) as ms, or `null` when absent or unreadable. */
function wireMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Older than the silence window against `asOf` — or absent, which is never "fresh". */
function isOld(value: string | null, asOf: string): boolean {
  const ms = wireMs(value)
  const now = wireMs(asOf)
  if (ms == null || now == null) return true
  return now - ms > TILL_SILENT_AFTER_MS
}

/** The till has not stamped presence within the window (or never did): it may be off, or its WAN down. */
export function tillSilent(till: Pick<Till, 'lastSeenAt'>, asOf: string): boolean {
  return isOld(till.lastSeenAt, asOf)
}

/** What one link cell of `till` says, as of the door's `asOf`. */
export function tillLinkCell(link: LinkVerdict | null, till: Pick<Till, 'lastSeenAt' | 'reportedAt'>, asOf: string): TillLinkCell {
  if (!link)
    return { kind: 'noData', labelKey: 'tills.states.noData', sev: 'mute', state: null, figures: null, since: null }

  const figures =
    link.state === 'local' || (link.failPct == null && link.slowPct == null && link.p95Ms == null)
      ? null
      : { failPct: link.failPct, slowPct: link.slowPct, p95Ms: link.p95Ms }

  if (tillSilent(till, asOf) || isOld(till.reportedAt, asOf))
    return { kind: 'silent', labelKey: 'tills.states.silent', sev: 'mute', state: link.state, figures, since: link.since }

  const badge = codeBadge(LINK_SEVERITY, 'tills.states', link.state)
  return { kind: 'verdict', labelKey: badge.labelKey, sev: badge.sev, state: link.state, figures, since: link.since }
}

// ── BackOffice 4292: one till's 7-day hour strip ────────────────────────────────────────────────────────────────

/**
 * What one hour of one link reads as, worst first. The till judged instability itself (`unstableSeconds`,
 * `offlineSeconds`); a failed or slow check that never tipped the window is a **blip**, shown faded so L1 can still
 * see it; an hour with no row is **no data** — the till was off, silent, or on an older build — never healthy.
 */
export const TILL_HOUR_CELLS = ['online', 'blips', 'unstable', 'offline', 'noData'] as const
export type TillHourCell = (typeof TILL_HOUR_CELLS)[number]

/** Token classes only: the palette lint refuses literal colours. The console's hour-strip palette. */
const TILL_HOUR_SWATCH: Record<TillHourCell, string> = {
  online: 'bg-success',
  blips: 'bg-success/35',
  unstable: 'bg-attention',
  offline: 'bg-danger',
  noData: 'bg-muted',
}

export interface TillHourLegendEntry {
  cell: TillHourCell
  /** Its `sync-console` label key. */
  labelKey: string
  swatch: string
}

const legendOf = (cell: TillHourCell): TillHourLegendEntry => ({
  cell,
  labelKey: `tills.history.cells.${cell}`,
  swatch: TILL_HOUR_SWATCH[cell],
})

/** The legend under the drill-in's strip, every cell in order. */
export const TILL_HOUR_LEGEND: readonly TillHourLegendEntry[] = TILL_HOUR_CELLS.map(legendOf)

/** One link's hour as a strip cell. */
export function tillHourCell(link: LinkHour | null): TillHourLegendEntry {
  if (!link) return legendOf('noData')
  if (link.offlineSeconds > 0) return legendOf('offline')
  if (link.unstableSeconds > 0) return legendOf('unstable')
  if (link.failed > 0 || link.slow > 0) return legendOf('blips')
  return legendOf('online')
}

export type TillHourFigures = {
  checks: number
  failed: number
  slow: number
  p95Ms: number
  unstableMinutes: number
  offlineMinutes: number
}

/** Seconds as whole minutes, a part-minute rounding to the nearest (30 s and over reads as a minute). */
const minutesOf = (seconds: number) => Math.round(seconds / 60)

/** The hour's numbers as L1 reads them to the network team; `null` for an hour with no row. */
export function tillHourFigures(link: LinkHour | null): TillHourFigures | null {
  if (!link) return null
  return {
    checks: link.checks,
    failed: link.failed,
    slow: link.slow,
    p95Ms: link.maxP95Ms,
    unstableMinutes: minutesOf(link.unstableSeconds),
    offlineMinutes: minutesOf(link.offlineSeconds),
  }
}

/** "Unstable or offline in `troubled` of the `reported` hours this link has rows for" — the sentence over the strip. */
export function tillHistorySummary(hours: readonly TillHour[], link: 'wan' | 'store'): { reported: number; troubled: number } {
  let reported = 0
  let troubled = 0
  for (const h of hours) {
    const cell = tillHourCell(h[link]).cell
    if (cell === 'noData') continue
    reported++
    if (cell === 'unstable' || cell === 'offline') troubled++
  }
  return { reported, troubled }
}

// ── BackOffice 4292: the fleet's per-store count ────────────────────────────────────────────────────────────────

/**
 * The fleet row's "tills unstable now" cell: the door's count, amber when any till of the store is on an unstable or
 * offline link. `null` (blank) when the door did not send it — a pre-4292 host — never a 0 that would read as "fine".
 */
export function unstableTillsCell(row: Pick<StoreRow, 'unstableTills'>): { text: string; sev: Severity } | null {
  if (row.unstableTills == null) return null
  return { text: String(row.unstableTills), sev: row.unstableTills > 0 ? 'warn' : 'mute' }
}

/** The page's total: tills on an unstable or offline link, and the stores they are in. */
export function fleetUnstableTills(rows: readonly Pick<StoreRow, 'unstableTills'>[]): { tills: number; stores: number } {
  let tills = 0
  let stores = 0
  for (const row of rows) {
    if (!row.unstableTills) continue
    tills += row.unstableTills
    stores++
  }
  return { tills, stores }
}
