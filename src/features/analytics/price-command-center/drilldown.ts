/**
 * The material drill-down's pure reading (oms 936, BackOffice spec 4127 decision 8): the price history chart's series
 * and rows, each competitor split by price source with the authoritative one solid and the other faint.
 *
 * ⚠ GUESSED (BO 4128): `ourHistory`, `history`, `authoritativeSource`, `matchId`, `matchedByUser` and `matchedAt` are not
 * on `Materials/{material}/Comparison` today. Every reader here treats them as optional — a pre-4128 answer is "no
 * history", never a crash. Reconcile against BO 4128 as shipped.
 */
import type { ChartSeries, ChartSeriesRow } from '@/core/charts/SeriesChart'
import { formatAxisDay } from '@/core/charts/format'
import type { PriceSource, PriceWatchComparison, PriceWatchCompetitorSide } from '@/core/models/price-watch'
import { fsi } from '@/core/util/bidi'

/** Which price a series draws: our basic / effective, a competitor's regular / offer. */
export type SeriesPrice = 'basic' | 'effective' | 'regular' | 'offer'

/** What a series' label is built from. `owner` is 'ours' or the competitor code. */
export interface SeriesSpec {
  owner: string
  /** The competitor's name ('' for ours). */
  name: string
  price: SeriesPrice
  /** 'OURS' for our price. */
  source: PriceSource | 'OURS'
  authoritative: boolean
}

/** A history series: the chart's own props plus what the key needs. */
export interface HistorySeries extends ChartSeries {
  faint: boolean
  dashed: boolean
  source: PriceSource | 'OURS'
  authoritative: boolean
}

/** The competitor's authoritative source: the wire's, else the source its authoritative observations carry, else SCRAPER. */
export function authorityOf(side: PriceWatchCompetitorSide): PriceSource {
  return side.authoritativeSource ?? side.history?.find((o) => o.isAuthoritative)?.source ?? 'SCRAPER'
}

const day = (stamp: string) => stamp.slice(0, 10)
/** Our slot 0; competitors 1..4 in the wire's order; past the palette, ink grey (`null`). */
const competitorSlot = (i: number) => (i + 1 < 5 ? i + 1 : null)

/**
 * The chart: our basic and effective price per day, and per competitor per source its regular and offer price — the
 * latest observation of that source on each day. A series with no value at all is left out. The shelf price (basic,
 * regular) is dashed beside the price paid; the cross-check source is faint.
 */
export function historyChart(
  c: PriceWatchComparison,
  { locale, label }: { locale: string; label: (spec: SeriesSpec) => string },
): { series: HistorySeries[]; rows: ChartSeriesRow[] } {
  const values = new Map<string, Map<string, number | null>>() // day → key → value
  const stamps = new Map<string, string>() // `${day}|${key}` → observedAt of the value kept
  const put = (d: string, key: string, v: number | null, at = '') => {
    const seen = stamps.get(`${d}|${key}`)
    if (seen !== undefined && seen > at) return
    stamps.set(`${d}|${key}`, at)
    if (!values.has(d)) values.set(d, new Map())
    values.get(d)!.set(key, v)
  }
  const series: HistorySeries[] = []
  const add = (spec: SeriesSpec, key: string, slot: number | null) =>
    series.push({
      key,
      label: label(spec),
      slot,
      other: false,
      unit: 'SAR',
      faint: spec.source !== 'OURS' && !spec.authoritative,
      dashed: spec.price === 'basic' || spec.price === 'regular',
      source: spec.source,
      authoritative: spec.authoritative,
    })

  for (const p of c.ourHistory ?? []) {
    put(p.priceDay, 'ours.effective', p.isPriced ? p.effectivePrice : null)
    put(p.priceDay, 'ours.basic', p.isPriced ? p.basicPrice : null)
  }
  const ours = (price: SeriesPrice): SeriesSpec => ({ owner: 'ours', name: '', price, source: 'OURS', authoritative: true })
  add(ours('effective'), 'ours.effective', 0)
  add(ours('basic'), 'ours.basic', 0)

  c.competitors.forEach((side, i) => {
    const authority = authorityOf(side)
    // The authoritative source first, so its line is listed (and drawn) before the cross-check.
    const sources = [authority, ...(['SCRAPER', 'MINDSITE'] as const).filter((s) => s !== authority)]
    for (const o of side.history ?? []) {
      put(day(o.observedAt), `${side.competitorCode}.${o.source}.regular`, o.regularPrice, o.observedAt)
      put(day(o.observedAt), `${side.competitorCode}.${o.source}.offer`, o.offerPrice, o.observedAt)
    }
    for (const source of sources)
      for (const price of ['offer', 'regular'] as const)
        add(
          { owner: side.competitorCode, name: side.competitorName, price, source, authoritative: source === authority },
          `${side.competitorCode}.${source}.${price}`,
          competitorSlot(i),
        )
  })

  const days = [...values.keys()].sort()
  const drawn = series.filter((s) => days.some((d) => typeof values.get(d)?.get(s.key) === 'number'))
  const rows: ChartSeriesRow[] = days.map((d) => ({
    x: d,
    label: formatAxisDay(d, locale),
    slot: null,
    values: Object.fromEntries(drawn.map((s) => [s.key, values.get(d)?.get(s.key) ?? null])),
  }))
  return { series: drawn, rows: drawn.length ? rows : [] }
}

/** The URL parameter that names the material whose drill-down is open. */
export const DRILLDOWN_PARAM = 'material'

/**
 * 🔗 The ONE way to open (or close) the drill-down: the page's search string with `?material=` set (or removed for
 * `null`), every other parameter (the open tab) kept. Any tab links to it — the alert row (934), the product grid (935),
 * the cross-check list (939): `<Link to={{ search: drillDownSearch(location.search, material) }} replace>`.
 */
export function drillDownSearch(search: string | URLSearchParams, material: string | null): string {
  const params = new URLSearchParams(search)
  const m = material?.trim() ?? ''
  if (m) params.set(DRILLDOWN_PARAM, m)
  else params.delete(DRILLDOWN_PARAM)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** The material the URL names, or null when the drill-down is closed. */
export function drillDownMaterial(search: string | URLSearchParams): string | null {
  return new URLSearchParams(search).get(DRILLDOWN_PARAM)?.trim() || null
}

/** A per-unit price at the wire's four decimals. */
const perUnit = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false })

/** A comparable match's per-unit comparison: both prices per g / ml / piece and the cheaper side. */
export interface PerUnitView {
  basis: 'g' | 'ml' | 'piece'
  ours: string
  theirs: string
  cheaper: 'competitor' | 'us' | 'level'
}

/**
 * A comparable product match is compared per unit (its pack differs from ours): the server's per-unit prices, at four
 * decimals, with the cheaper side named. An exact match, or one with either per-unit price missing, has none.
 */
export function perUnitView(side: PriceWatchCompetitorSide): PerUnitView | null {
  const { perUnitBasis: basis, ourPricePerUnit: ours, theirPricePerUnit: theirs } = side
  if (side.matchKind !== 'Comparable' || basis === '' || ours === null || theirs === null) return null
  return { basis, ours: perUnit(ours), theirs: perUnit(theirs), cheaper: theirs < ours ? 'competitor' : theirs > ours ? 'us' : 'level' }
}

/** The comparison gap as the drill-down says it: which side is cheaper, and by how much (unsigned). */
export interface ComparisonGap {
  kind: 'competitorCheaper' | 'weCheaper' | 'level' | 'none'
  percent: string
}

/**
 * 🔑 The comparison wire's `gapPercent` is (theirs − ours) ÷ ours × 100: NEGATIVE = the competitor is cheaper — the
 * OPPOSITE sense to the price alert's `gapPercent` (positive = competitor cheaper). The sign is read here, once, and
 * turned into words; the figure shown is unsigned, so the two wires never meet in one number.
 */
export function comparisonGap(gapPercent: number | null): ComparisonGap {
  if (gapPercent === null || !Number.isFinite(gapPercent)) return { kind: 'none', percent: '' }
  const percent = `${Math.abs(gapPercent).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  return { kind: gapPercent < 0 ? 'competitorCheaper' : gapPercent > 0 ? 'weCheaper' : 'level', percent }
}

/** A BO stamp, or null for "never" (a year-1 stamp, blank or absent). */
export function stampOrNull(stamp: string | null | undefined): string | null {
  return !stamp || stamp.startsWith('0001-') ? null : stamp
}

/** The labels in the `price-command-center` namespace: "Our effective price", "Nahdi: offer price from Mindsite (authoritative)". */
export function seriesLabelWith(t: (key: string, options?: Record<string, unknown>) => string): (spec: SeriesSpec) => string {
  return (spec) => {
    if (spec.source === 'OURS') return t(`drilldown.series.ours.${spec.price}`)
    const source = t(`drilldown.source.${spec.source}`)
    return t('drilldown.series.competitor', {
      name: fsi(spec.name || spec.owner),
      price: t(`drilldown.price.${spec.price}`),
      source: spec.authoritative ? t('drilldown.authoritative', { source }) : source,
    })
  }
}
