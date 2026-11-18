/**
 * The Stock health page's rules (oms 908, BackOffice spec 4011). Pure, pinned by `health.test.ts`.
 *
 * No verdict is decided here: the server judges, the page draws. What lives here is how a verdict is drawn, how the header
 * counts, and how a reason or a figure label is put into Arabic.
 */
import type { StockHealthSignal } from '@/core/models/stock-health'
import { fsi } from '@/core/util/bidi'

/** The header: "All good", or "N need attention". A `null` verdict is not judged, so it never counts either way. */
export interface HeaderLine {
  /** `empty`: the server sent no signal at all, which is not "All good". */
  kind: 'allGood' | 'attention' | 'empty'
  count: number
}

/** Every judged signal that is not `good` needs attention: watch, bad, noAnswer, and a verdict this page does not know. */
export function headerLine(signals: readonly StockHealthSignal[]): HeaderLine {
  if (signals.length === 0) return { kind: 'empty', count: 0 }
  const count = signals.filter((s) => s.verdict != null && s.verdict !== 'good').length
  return { kind: count === 0 ? 'allGood' : 'attention', count }
}

/**
 * How a tile is drawn. `noAnswer` is its own tone (red-outlined, "did not answer"), never `neutral`: a dead source is
 * not fine. A verdict this page does not know draws as `watch`, so a new word from the server is never green or grey.
 */
export type Tone = 'good' | 'watch' | 'bad' | 'noAnswer' | 'neutral'

export function verdictTone(verdict: string | null | undefined): Tone {
  switch (verdict) {
    case null:
    case undefined:
      return 'neutral'
    case 'good':
    case 'watch':
    case 'bad':
    case 'noAnswer':
      return verdict
    default:
      return 'watch'
  }
}

/** The slice of i18next's `t` these helpers need, so the pure tests pass a real instance and the page passes its own. */
export type Translate = (key: string, options?: Record<string, unknown>) => unknown

const TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})$/

/** A figure's value as text: a number as is, a wall-clock time without its `T` (never parsed, so never shifted), null "—". */
export function figureText(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') return String(value)
  const time = TIME.exec(value)
  return time ? `${time[1]} ${time[2]}` : value
}

/**
 * The reason line. The key is `reason.<key>.<verdict>` (`none` for a figure-only signal). English holds `{{reason}}` for
 * each, so English shows the server's own line; Arabic holds a sentence with the signal's figures interpolated by
 * position (`{{f1}}` is the first figure), each isolated (`bidi`). `{{detail}}` is the server's line, isolated, for the
 * facts Arabic cannot rebuild from the figures (which door did not answer and how; which DRS instance is slow or silent). A key or verdict the locale does
 * not hold falls back to the server's English line.
 */
export function reasonText(t: Translate, signal: StockHealthSignal): string {
  const vars: Record<string, unknown> = {
    reason: signal.reason,
    detail: fsi(signal.reason),
    defaultValue: signal.reason,
  }
  signal.figures.forEach((f, i) => {
    vars[`f${i + 1}`] = fsi(figureText(f.value))
  })
  const text = t(`reason.${signal.key}.${signal.verdict ?? 'none'}`, vars)
  return typeof text === 'string' && text ? text : signal.reason
}

/** A figure's label: `figure.<key>` maps the English label to the locale's; a label it does not hold stays English. */
export function figureLabel(t: Translate, key: string, label: string): string {
  const labels = t(`figure.${key}`, { returnObjects: true, defaultValue: null })
  const mapped = labels && typeof labels === 'object' ? (labels as Record<string, unknown>)[label] : undefined
  return typeof mapped === 'string' && mapped ? mapped : label
}

/** The page re-reads the door every minute (the server caches its answer for 30 seconds, so no faster). */
export const REFRESH_MS = 60_000

/** A tile shows at most five figures, in the server's order (S7 sends five: the four stages and the stuck-seeding count). */
export const MAX_FIGURES = 5

export function figuresShown(signal: StockHealthSignal) {
  return (signal.figures ?? []).slice(0, MAX_FIGURES)
}

/** A tile's link as an app path. Only a route of this app opens: anything with a scheme or a host is dropped. */
export function tileHref(link: string | null | undefined): string | null {
  const route = (link ?? '').trim()
  if (!route || route.startsWith('//') || route.includes(':')) return null
  return `/${route.replace(/^\/+/, '')}`
}

/** "as of": the answer's wall-clock as sent, with a space for the `T`. Never parsed, so never shifted. */
export function asOf(readAt: string | null | undefined): string {
  return readAt ? figureText(readAt) : ''
}
