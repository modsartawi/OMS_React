import type { AnalyticsModel, AnalyticsSeries, AnalyticsViewDefinition } from '@/core/models/analytics'
import { seriesOf } from './series'
import { measureOf } from './wire'

/**
 * Live figures (spec 819 §C/§E, ticket 827; 801 §3) — pure. A report's text block holds tokens
 * `{panel:figure}`: `{p3:hs}` is panel p3's series `hs`, `{p1:total}` panel p1's total. The server fills
 * them per run (`POST Analytics/Report/{id}/Words` → `figures`, each already formatted to the panel's
 * display format); the screen only splits the text and puts each value in its place. A token the answer
 * lacks is a `missing` segment and a token not yet answered `pending` — the raw token never reaches a reader.
 *
 * The designer (829) inserts and validates tokens with the same `tokensIn` / `figuresOf`.
 */

/** `{panel:figure}`: a panel id (a slug) and a figure (a series id, or `total`). */
export const FIGURE_TOKEN = /\{([a-z0-9][a-z0-9-]*):([a-z0-9_]+)\}/g

export interface FigureToken {
  /** The token as written, braces included: the key of the Words answer's `figures`. */
  token: string
  panel: string
  figure: string
}

export const tokensIn = (text: string): FigureToken[] => [...text.matchAll(FIGURE_TOKEN)].map((m) => ({ token: m[0], panel: m[1], figure: m[2] }))

export type FigureSegment =
  | { kind: 'text'; text: string }
  | { kind: 'figure'; token: string; value: string }
  | { kind: 'missing'; token: string }
  | { kind: 'pending'; token: string }

/** The Words answer's filled figures: token → formatted value. ⚠ A key without its braces (`p1:total`) is read too. */
export type FilledFigures = Readonly<Record<string, string>>

/** `text` split into its words and its figures, filled from `figures` (`null` while the answer is on its way). */
export function fillTokens(text: string, figures: FilledFigures | null): FigureSegment[] {
  const out: FigureSegment[] = []
  let at = 0
  for (const m of text.matchAll(FIGURE_TOKEN)) {
    const index = m.index ?? 0
    if (index > at) out.push({ kind: 'text', text: text.slice(at, index) })
    const token = m[0]
    const value = figures ? (figures[token] ?? figures[token.slice(1, -1)]) : undefined
    out.push(!figures ? { kind: 'pending', token } : value ? { kind: 'figure', token, value } : { kind: 'missing', token })
    at = index + token.length
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) })
  return out
}

/** A single value a panel offers a text block: one per named series, or the total of an additive measure. */
export interface PanelFigure {
  figure: string
  /** The series it is, or `null` for the panel's total. */
  series: AnalyticsSeries | null
}

/**
 * The figures a panel offers (801 §3): one per named series; else, for an additive first measure, its
 * `total`. A rate or percentile has no total (a sum of rates means nothing), so without series it offers none.
 */
export function figuresOf(definition: AnalyticsViewDefinition, model: AnalyticsModel): PanelFigure[] {
  const series = seriesOf(definition)
  if (series.length > 0) return series.map((s) => ({ figure: s.id, series: s }))
  // 829: a KPI (one figure, no breakdown) is a single value whatever its shape: the server computes it over the run.
  if (definition.chart.type === 'kpi' && definition.query.dimensions.length === 0 && definition.query.measures.length > 0) return [{ figure: 'total', series: null }]
  const first = measureOf(model, definition.query.measures[0])
  return first?.shape === 'additive' ? [{ figure: 'total', series: null }] : []
}

// ── The designer's side (829): writing tokens, and the text ↔ chip round-trip ──────────────────────────────

/** The token naming one figure of one panel: `{p2:hs}`. */
export const figureToken = (panel: string, figure: string): string => `{${panel}:${figure}}`

/** A text block's words as the designer shows them: its words, and each live figure as a chip — never a raw token. */
export type ChipSegment = { kind: 'text'; text: string } | { kind: 'chip'; token: string; panel: string; figure: string }

/** `text` split into its words and its figure chips. `chipsText` puts it back exactly. */
export function chipSegments(text: string): ChipSegment[] {
  const out: ChipSegment[] = []
  let at = 0
  for (const m of text.matchAll(FIGURE_TOKEN)) {
    const index = m.index ?? 0
    if (index > at) out.push({ kind: 'text', text: text.slice(at, index) })
    out.push({ kind: 'chip', token: m[0], panel: m[1], figure: m[2] })
    at = index + m[0].length
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) })
  return out
}

/** The text a run of words and chips holds: each chip is its token. */
export const chipsText = (segments: readonly ChipSegment[]): string => segments.map((s) => (s.kind === 'text' ? s.text : s.token)).join('')

/**
 * A figure's token inserted at `at` (a character offset into `text`, clamped; the end when absent), with a
 * space on either side where a word would touch it. Answers the new text and the offset just after the token.
 */
export function insertToken(text: string, token: string, at?: number): { text: string; caret: number } {
  // Never inside another token: an offset within one moves to its end.
  let place = Math.max(0, Math.min(at ?? text.length, text.length))
  for (const m of text.matchAll(FIGURE_TOKEN)) {
    const start = m.index ?? 0
    if (place > start && place < start + m[0].length) place = start + m[0].length
  }
  const before = text.slice(0, place)
  const after = text.slice(place)
  const lead = before && !/\s$/.test(before) ? ' ' : ''
  const trail = after && !/^[\s.,;:!?،؛]/.test(after) ? ' ' : ''
  const next = `${before}${lead}${token}${trail}${after}`
  return { text: next, caret: before.length + lead.length + token.length }
}
