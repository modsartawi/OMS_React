import type { RoadShadowQuery, RoadShadowReport } from '@/core/models/dispatch-board'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

// The road Shadow report's view (ticket 859, BackOffice spec 3460 / door 3470): the shares, the fallback total and
// its warning, the reasons in words, the median, and the filters kept in the URL. Pure, pinned by `road-shadow.test.ts`.
//
// 🚩 Every count is the door's. The only figures worked out here are DISPLAY: each tile's share of Measured, and the
// fallbacks' share of every delivery the range tried to measure (measured + Σ fallbacks).

/** The type the page opens on: QC is the one in Shadow (BackOffice 3473). */
export const DEFAULT_SHADOW_TYPE = 'QC'
/** The window the page opens on, in days ending today (inclusive). The door's own default is 30. */
export const DEFAULT_SHADOW_DAYS = 7
/** What "about normal" reads as beside the median (runbook §4: "~1.3 is normal in cities"). */
export const NORMAL_ROAD_RATIO = '1.3'
/** Above this share of the range's deliveries, fallbacks are high (runbook §4: "under ~2%"). */
export const FALLBACK_WARN_SHARE = 0.02

/** The page's query, as its URL holds it. `from`/`to` '' = the default range; `type` '' = All types. */
export interface ShadowFilters {
  from: string
  to: string
  type: string
}

/**
 * The filters a URL describes. No `type` param = QC; a present-but-blank `type=` = All types (the door's '').
 */
export function shadowFiltersFromParams(params: URLSearchParams): ShadowFilters {
  const type = params.get('type')
  return {
    from: (params.get('from') ?? '').trim(),
    to: (params.get('to') ?? '').trim(),
    type: type === null ? DEFAULT_SHADOW_TYPE : type.trim().toUpperCase(),
  }
}

/** The filters as their URL. The defaults write nothing; All types writes `type=`. */
export function shadowFiltersToParams(filters: ShadowFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.from) qs.set('from', filters.from)
  if (filters.to) qs.set('to', filters.to)
  if (filters.type !== DEFAULT_SHADOW_TYPE) qs.set('type', filters.type)
  return qs
}

export type ShadowRange = { ok: true; from: string; to: string } | { ok: false }

/** A strict `yyyy-MM-dd` that names a real day (`2026-02-30` does not). */
function realDay(value: string): string | null {
  const date = fromIsoDate(value)
  return date && toIsoDate(date) === value.trim() ? toIsoDate(date) : null
}

/**
 * The range the door is asked for. Both ends blank = the last 7 days ending today. A half-typed range makes no call.
 * A reversed or too-long range IS sent: the door refuses it with `CALLOUT-302` / `301` in its own bilingual words.
 */
export function resolveShadowRange(filters: Pick<ShadowFilters, 'from' | 'to'>, now: Date): ShadowRange {
  if (!filters.from && !filters.to) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DEFAULT_SHADOW_DAYS - 1))
    return { ok: true, from: toIsoDate(start), to: toIsoDate(now) }
  }
  const from = realDay(filters.from)
  const to = realDay(filters.to)
  return from && to ? { ok: true, from, to } : { ok: false }
}

const shiftDays = (iso: string, days: number): string => {
  const d = fromIsoDate(iso)!
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/**
 * One end picked: the other end is the one shown, unless that would reverse the range — then it is the default
 * window's width from the picked day. A half-typed (blank or unreal) pick is kept as typed.
 */
export function pickRangeEnd(prev: ShadowFilters, end: 'from' | 'to', value: string, shown: { from: string; to: string }): ShadowFilters {
  if (!realDay(value)) return { ...prev, [end]: value }
  const width = DEFAULT_SHADOW_DAYS - 1
  if (end === 'from') {
    const to = prev.to || (shown.to && shown.to >= value ? shown.to : shiftDays(value, width))
    return { ...prev, from: value, to }
  }
  const from = prev.from || (shown.from && shown.from <= value ? shown.from : shiftDays(value, -width))
  return { ...prev, to: value, from }
}

/** What the read sends. A blank type is the door's every type (`buildQuery` drops it, and absent reads as ''). */
export function shadowWire(filters: ShadowFilters, range: { from: string; to: string }): Required<RoadShadowQuery> {
  return { from: range.from, to: range.to, type: filters.type }
}

/** Half away from zero at `places` on the decimal value, not on its binary neighbour (1.315 → 1.32, never 1.31). */
function roundHalfUp(value: number, places: number): number {
  const scale = 10 ** places
  return (Math.sign(value) * Math.round(Number((Math.abs(value) * scale).toPrecision(12)))) / scale
}

/** `part` of `whole` in percent, to one place; null when the whole is 0 (never a divide-by-zero). */
function sharePercent(part: number, whole: number): number | null {
  return whole > 0 ? roundHalfUp((part / whole) * 100, 1) : null
}

/**
 * `part` of `whole` as a percentage to one place, no trailing `.0`; `dash` (the locale's "no value") when the
 * whole is 0. The `%` is a machine value's unit, isolated with it by the screen.
 */
export function formatShare(part: number, whole: number, dash: string): string {
  const pct = sharePercent(part, whole)
  return pct === null ? dash : `${pct}%`
}

export type HeadlineKey = 'measured' | 'removed' | 'widened' | 'competed'

export interface HeadlineTile {
  key: HeadlineKey
  value: number
  /** Its share of Measured, display only. */
  share: string
}

/** The four headline tiles, in the ticket's order. */
export function headlineTiles(r: RoadShadowReport, dash: string): HeadlineTile[] {
  const tile = (key: HeadlineKey, value: number): HeadlineTile => ({ key, value, share: formatShare(value, r.measured, dash) })
  return [
    tile('measured', r.measured),
    tile('removed', r.roadWouldRemoveBids),
    tile('widened', r.roadWouldWiden),
    tile('competed', r.competedWouldDiffer),
  ]
}

export interface FallbackSummary {
  total: number
  /** The total's share of measured + Σ fallbacks. */
  share: string
  /** Over 2% as SHOWN (rounded to one place): the panel takes the warning tone, never beside a share reading "2%". */
  high: boolean
}

export function fallbackSummary(r: RoadShadowReport, dash: string): FallbackSummary {
  const total = r.fallbacks.reduce((sum, f) => sum + f.count, 0)
  const whole = r.measured + total
  const pct = sharePercent(total, whole)
  return { total, share: formatShare(total, whole, dash), high: pct !== null && pct > FALLBACK_WARN_SHARE * 100 }
}

/** The `RoadDistanceFailureReasons` codes the runbook §6 names. */
export const KNOWN_FALLBACK_REASONS = ['TIMEOUT', 'QUOTA', 'KEY', 'HTTP_ERROR', 'BAD_RESPONSE', 'ERROR', 'NOT_CONFIGURED'] as const

export type FallbackReasonReading =
  | { known: true; code: string; labelKey: string; hintKey: string }
  | { known: false; code: string }

/** A known reason in words with its runbook action; anything else as the door sent it. */
export function fallbackReason(reason: string): FallbackReasonReading {
  const code = reason.trim().toUpperCase()
  return (KNOWN_FALLBACK_REASONS as readonly string[]).includes(code)
    ? { known: true, code, labelKey: `roadShadow.reasons.${code}.label`, hintKey: `roadShadow.reasons.${code}.hint` }
    : { known: false, code: reason.trim() }
}

/** The median to 2 decimals, or the words for none. */
export function medianReading(ratio: number | null): { ratio: string } | { noneKey: string } {
  return ratio == null ? { noneKey: 'roadShadow.median.none' } : { ratio: roundHalfUp(ratio, 2).toFixed(2) }
}

/** Nothing measured and nothing fell back: the type is likely not in Shadow. */
export function isEmptyRange(r: RoadShadowReport): boolean {
  return r.measured === 0 && r.fallbacks.length === 0
}
