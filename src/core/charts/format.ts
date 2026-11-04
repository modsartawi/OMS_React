import type { AnalyticsNumberFormat, MeasureUnit } from '@/core/models/analytics'

/**
 * Formats by unit, through `Intl` under the active locale (spec 766 §F, ticket 767).
 *
 * Latin digits in every locale (`-u-nu-latn`): the app draws its figures that way whatever the
 * language (`@/core/util/number-format`'s `formatFigure`), and a chart must read the same as the grid
 * beside it. The output is PLAIN text — never `fsi()` — because a tick and a tooltip reach copied text;
 * the caller isolates a value it puts in a sentence (`.claude/rules/bidi.md`).
 *
 * The definition's own number formats (auto, integer, decimal, %, SAR, minutes) sit on top: {@link formatAs}.
 */

const latn = (locale: string) => `${locale.split('-')[0] || 'en'}-u-nu-latn`

const cache = new Map<string, Intl.NumberFormat>()
function nf(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let f = cache.get(key)
  if (!f) cache.set(key, (f = new Intl.NumberFormat(latn(locale), options)))
  return f
}

const OPTIONS: Record<MeasureUnit, Intl.NumberFormatOptions> = {
  count: { maximumFractionDigits: 0 },
  SAR: { style: 'currency', currency: 'SAR', currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  minutes: { style: 'unit', unit: 'minute', unitDisplay: 'short', maximumFractionDigits: 1 },
  seconds: { style: 'unit', unit: 'second', unitDisplay: 'short', maximumFractionDigits: 0 },
  km: { style: 'unit', unit: 'kilometer', unitDisplay: 'short', maximumFractionDigits: 1 },
  share: { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 },
}

/** One value as a tooltip or a label says it. `''` for no value. */
export function formatValue(value: number | null | undefined, unit: MeasureUnit, locale: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return nf(locale, OPTIONS[unit] ?? OPTIONS.count).format(value)
}

/** A value-axis tick: compact (`12K`), and a share as a whole percent. */
export function formatTick(value: number, unit: MeasureUnit, locale: string): string {
  if (!Number.isFinite(value)) return ''
  if (unit === 'share') return nf(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value)
  return nf(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/**
 * An estate time (`yyyy-MM-ddTHH:mm:ss`, Riyadh local, or ISO) as `HH:MM` — the freshness line's
 * "data as of". `''` when it does not read as a time.
 */
export function formatClock(value: string | null | undefined, locale: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1900) return ''
  return new Intl.DateTimeFormat(latn(locale), { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

/** A day (`yyyy-MM-dd`) as the active locale writes a short date, Latin digits. */
export function formatDay(value: string | null | undefined, locale: string): string {
  if (!value) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Intl.DateTimeFormat(latn(locale), { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

const FORMAT_OPTIONS: Record<Exclude<AnalyticsNumberFormat, 'auto'>, Intl.NumberFormatOptions> = {
  integer: { maximumFractionDigits: 0 },
  decimal: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  percent: OPTIONS.share,
  SAR: OPTIONS.SAR,
  minutes: { style: 'unit', unit: 'minute', unitDisplay: 'short', maximumFractionDigits: 0 },
}

/**
 * One value in the definition's number format (766 story 43, ticket 768); `auto` (or none) follows the
 * measure's unit through {@link formatValue}. `''` for no value. Plain text, never `fsi()`.
 */
export function formatAs(
  value: number | null | undefined,
  format: AnalyticsNumberFormat | null | undefined,
  unit: MeasureUnit,
  locale: string,
): string {
  if (!format || format === 'auto') return formatValue(value, unit, locale)
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return nf(locale, FORMAT_OPTIONS[format]).format(value)
}

/** A value-axis tick in the definition's format: compact, and a percent as a whole percent. */
export function formatTickAs(value: number, format: AnalyticsNumberFormat | null | undefined, unit: MeasureUnit, locale: string): string {
  return formatTick(value, format === 'percent' ? 'share' : unit, locale)
}

/** A day (`yyyy-MM-dd`) as a short axis label (`1 Nov`); anything else as it came. */
export function formatAxisDay(value: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return value
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Intl.DateTimeFormat(latn(locale), { day: 'numeric', month: 'short' }).format(d)
}
