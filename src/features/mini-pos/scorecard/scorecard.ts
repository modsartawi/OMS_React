/**
 * The Mini POS scorecard's pure half (oms 918, BackOffice 4075): what the report sends, how the payback ratio is
 * coloured against the trial's two bars (3710 M10), the settling-in week the uplift leaves out (M12), the weekly view's
 * grouping (M15), and how a refusal reads. The server computes every figure; nothing here re-derives one.
 */
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import type {
  MiniPosOffListLine,
  MiniPosScorecardInputs,
  MiniPosScorecardQuery,
  MiniPosVerdict,
  MiniPosWeeklyPaidShare,
} from '@/core/models/mini-pos-scorecard'
import type { Severity } from '@/core/ui/severity'

/** 3710 M10: go at or above this ratio. */
export const GO_BAR = 1.2
/** 3710 M10: no-go below this ratio; between the two bars the panel weighs the supporting measures. */
export const NO_GO_BAR = 1.0

/** 3710 M16's scanner triggers: more than 1 line in 20 typed, or a median read above 3 seconds. */
export const TYPED_SHARE_TRIGGER = 0.05
export const MEDIAN_READ_TRIGGER_MS = 3000

/** The refusal code of a bad input (4075). */
export const INVALID_CODE = 'MINIPOS_SCORECARD_INVALID'

/** The query's wire params; an absent or blank input is left out so the server's configured calendar answers. */
export function queryParams(q: MiniPosScorecardQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(q)) {
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    out[key] = value
  }
  return out
}

/** What the form holds, as typed. */
export interface ScorecardDraft {
  trialFrom: string
  trialTo: string
  settlingInEnd: string
  comparisonOffsetDays: string
  promoterCost: string
}

export const EMPTY_DRAFT: ScorecardDraft = { trialFrom: '', trialTo: '', settlingInEnd: '', comparisonOffsetDays: '', promoterCost: '' }

/** The form as a query: blank stays absent (the server's config answers); numbers as typed (the server refuses a bad one). */
export function draftToQuery(d: ScorecardDraft): MiniPosScorecardQuery {
  const num = (s: string): number | undefined => {
    const v = s.trim()
    if (v === '') return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  const day = (s: string): string | undefined => s.trim() || undefined
  return {
    trialFrom: day(d.trialFrom),
    trialTo: day(d.trialTo),
    settlingInEnd: day(d.settlingInEnd),
    comparisonOffsetDays: num(d.comparisonOffsetDays),
    promoterCost: num(d.promoterCost),
  }
}

/** Where a payback ratio stands against the two bars: `none` when there is no ratio to place. */
export type RatioBand = 'go' | 'panel' | 'no-go' | 'none'

export function ratioBand(ratio: number | null | undefined): RatioBand {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return 'none'
  if (ratio >= GO_BAR) return 'go'
  if (ratio >= NO_GO_BAR) return 'panel'
  return 'no-go'
}

/** The band's colour, in the severity vocabulary: go is good, between the bars needs a human, below 1.0× is bad. */
export const BAND_SEVERITY: Record<RatioBand, Severity> = { go: 'ok', panel: 'warn', 'no-go': 'bad', none: 'mute' }

const VERDICTS: readonly MiniPosVerdict[] = ['go', 'panel', 'no-go', 'no-cost', 'no-base']

/** The i18n key under `verdict.*` for the server's verdict; anything unknown reads as unknown, never as a go. */
export function verdictKey(verdict: string | null | undefined): MiniPosVerdict | 'unknown' {
  return (VERDICTS as readonly string[]).includes(verdict ?? '') ? (verdict as MiniPosVerdict) : 'unknown'
}

/** The settling-in week the uplift leaves out (3710 M12), or null when the trial has none. */
export function settlingInWeek(inputs: Pick<MiniPosScorecardInputs, 'trialFrom' | 'settlingInEnd'>): { from: string; to: string } | null {
  const end = inputs.settlingInEnd ? day(inputs.settlingInEnd) : ''
  const from = day(inputs.trialFrom)
  if (!end || !from || end < from) return null
  return { from, to: end }
}

/**
 * The two costs the money test shows (owner ruling 2026-11-20): the ratio is judged on the cost PRORATED to the counted
 * days, shown beside the full cost the panel entered. Both are the server's figures; the prorated one is not computed
 * here (until the 4075 fix sends it, it reads as not sent). `days` is `counted/trial` when the server says both.
 */
export function ratioCost(
  inputs: Pick<MiniPosScorecardInputs, 'promoterCost' | 'countedPromoterCost' | 'countedDays' | 'trialDays'>,
): { entered: boolean; full: number; counted: number | null; days: string } {
  const full = typeof inputs.promoterCost === 'number' && Number.isFinite(inputs.promoterCost) ? inputs.promoterCost : 0
  const counted = typeof inputs.countedPromoterCost === 'number' && Number.isFinite(inputs.countedPromoterCost) ? inputs.countedPromoterCost : null
  const days = inputs.countedDays && inputs.trialDays ? `${inputs.countedDays}/${inputs.trialDays}` : ''
  return { entered: full > 0, full, counted, days }
}

/** The calendar day of a wire date or timestamp (`yyyy-MM-dd`). */
export const day = (value: string | null | undefined): string => (value ?? '').slice(0, 10)

/** Whole days from `a` to `b` (calendar arithmetic on the two local days, no clock). */
function daysBetween(a: string, b: string): number {
  const at = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, (m || 1) - 1, d || 1)
  }
  return Math.round((at(b) - at(a)) / 86_400_000)
}

/** The trial week a day falls in (week 1 = `trialFrom` .. +6), as the server numbers its weekly paid share. */
export function trialWeek(trialFrom: string, date: string): number {
  return Math.floor(daysBetween(day(trialFrom), day(date)) / 7) + 1
}

/** The compliance-stop lines grouped by trial week, latest week first, each week's lines by date then store. */
export function offListByWeek(lines: readonly MiniPosOffListLine[], trialFrom: string): { week: number; lines: MiniPosOffListLine[] }[] {
  const weeks = new Map<number, MiniPosOffListLine[]>()
  for (const line of lines) {
    const w = trialWeek(trialFrom, line.trxDate)
    weeks.set(w, [...(weeks.get(w) ?? []), line])
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => b - a)
    .map(([week, ls]) => ({
      week,
      lines: [...ls].sort((x, y) => day(x.trxDate).localeCompare(day(y.trxDate)) || x.storeCode.localeCompare(y.storeCode)),
    }))
}

/** One cell of the weekly paid-share grid. */
export type WeekCell = MiniPosWeeklyPaidShare | null

export interface WeeklyGrid {
  weeks: { week: number; from: string; to: string }[]
  pharmacies: { storeCode: string; cells: WeekCell[]; pause: boolean; underHalf: boolean }[]
}

/**
 * The weekly paid share as a grid: one row per pharmacy, one column per trial week the answer holds (a week without orders
 * is an empty cell). A pharmacy carries `pause` when any week does (under half two weeks running, M15).
 */
export function weeklyGrid(rows: readonly MiniPosWeeklyPaidShare[]): WeeklyGrid {
  const weekMap = new Map<number, { week: number; from: string; to: string }>()
  for (const r of rows) if (!weekMap.has(r.week)) weekMap.set(r.week, { week: r.week, from: day(r.weekFrom), to: day(r.weekTo) })
  const weeks = [...weekMap.values()].sort((a, b) => a.week - b.week)
  const stores = [...new Set(rows.map((r) => r.storeCode))].sort((a, b) => a.localeCompare(b))
  return {
    weeks,
    pharmacies: stores.map((storeCode) => {
      const mine = rows.filter((r) => r.storeCode === storeCode)
      return {
        storeCode,
        cells: weeks.map((w) => mine.find((r) => r.week === w.week) ?? null),
        pause: mine.some((r) => r.pause),
        underHalf: mine.some((r) => r.underHalf),
      }
    }),
  }
}

/** A weekly cell's colour: pause is bad, under half needs a look, otherwise neutral. */
export function weekCellSeverity(cell: WeekCell): Severity {
  if (!cell) return 'mute'
  if (cell.pause) return 'bad'
  if (cell.underHalf) return 'warn'
  return 'ok'
}

/** How a failed read is shown. */
export interface ScorecardFailure {
  kind: 'invalid' | 'denied' | 'failed'
  /** The server's sentence, or the fallback. */
  message: string
  code: string | null
}

export function scorecardFailure(err: unknown, fallback: string): ScorecardFailure {
  const code = apiErrorCode(err)
  if (code === INVALID_CODE) return { kind: 'invalid', message: apiErrorMessage(err, fallback), code }
  if (isBareDenial(err)) return { kind: 'denied', message: '', code: null }
  return { kind: 'failed', message: apiErrorMessage(err, fallback), code }
}

// ── Formatting: figures are machine values, Latin digits, grouped. ──

const grouped = (v: number, decimals: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** SAR, two decimals, grouped. `''` when not computable. */
export const money = (v: number | null | undefined): string => (isNum(v) ? grouped(v, 2) : '')

/** A count, grouped. */
export const count = (v: number | null | undefined): string => (isNum(v) ? grouped(v, 0) : '')

/** A plain figure to `decimals` places. */
export const figure = (v: number | null | undefined, decimals = 1): string => (isNum(v) ? grouped(v, decimals) : '')

/** A fraction as a percent (0.305 → `30.5%`). */
export const percent = (v: number | null | undefined): string => (isNum(v) ? `${grouped(v * 100, 1)}%` : '')

/** A difference of two growth rates, in percentage points, signed (0.032 → `+3.2`). */
export const points = (v: number | null | undefined): string => (isNum(v) ? `${v > 0 ? '+' : ''}${grouped(v * 100, 1)}` : '')

/** A ratio with its times sign (1.234 → `1.23×`). */
export const times = (v: number | null | undefined): string => (isNum(v) ? `${grouped(v, 2)}×` : '')

/** Seconds as `m:ss` (or `h:mm:ss`). */
export function duration(seconds: number | null | undefined): string {
  if (!isNum(seconds)) return ''
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/**
 * The meter's geometry for a ratio: the scale runs from 0 to at least 1.5×, further when the ratio does, and each mark
 * (the ratio, 1.0×, 1.2×) is a percent of it. Geometry only — the figure is written beside the meter.
 */
export function meterGeometry(ratio: number | null | undefined): { fill: number; noGo: number; go: number } {
  const r = isNum(ratio) ? Math.max(0, ratio) : 0
  const max = Math.max(1.5, r * 1.1)
  const at = (v: number) => Math.round((v / max) * 1000) / 10
  return { fill: at(r), noGo: at(NO_GO_BAR), go: at(GO_BAR) }
}
