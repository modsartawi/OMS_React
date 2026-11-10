import type { AnalyticsLabel, AnalyticsModel, AnalyticsSeries, AnalyticsViewDefinition } from '@/core/models/analytics'
import { seriesOf } from './series'

/**
 * Live figures (spec 819 §C/§E, ticket 827; 801 §3) — pure. A report's text block holds tokens in the server's
 * shape (BackOffice spec 3408 §F, the authority; 819's `{panel:figure}` was drift, found on the 835 live walk):
 * `{{fig:<panel>:<measure>}}` is that measure over panel's whole selection, `{{fig:<panel>:<measure>:<series>}}`
 * one named series of it (a panel with series has no total across them). The server fills them per run
 * (`POST Analytics/Report/{id}/Words` → `figures`, keyed by the token as written, each formatted in both
 * languages); the screen only splits the text and puts each value in its place. A token the answer lacks is a
 * `missing` segment and a token not yet answered `pending` — the raw token never reaches a reader.
 *
 * The designer (829) inserts and validates tokens with the same `tokensIn` / `figuresOf`. A "figure" here is the
 * token's part after the panel: `measure` or `measure:series`.
 */

/** `{{fig:<panel>:<measure>[:<series>]}}` — each part as the server allows it (letters, digits, `_`, `-`). */
export const FIGURE_TOKEN = /\{\{fig:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)(?::([A-Za-z0-9_-]+))?\}\}/g

export interface FigureToken {
  /** The token as written, braces included: the key of the Words answer's `figures`. */
  token: string
  panel: string
  /** `measure`, or `measure:series`. */
  figure: string
  measure: string
  series: string | null
}

const figureOf = (measure: string, series: string | null | undefined) => (series ? `${measure}:${series}` : measure)

export const tokensIn = (text: string): FigureToken[] =>
  [...text.matchAll(FIGURE_TOKEN)].map((m) => ({ token: m[0], panel: m[1], figure: figureOf(m[2], m[3]), measure: m[2], series: m[3] ?? null }))

export type FigureSegment =
  | { kind: 'text'; text: string }
  | { kind: 'figure'; token: string; value: string }
  | { kind: 'missing'; token: string }
  | { kind: 'pending'; token: string }

/** The Words answer's filled figures: token (as written) → its words in both languages. */
export type FilledFigures = Readonly<Record<string, AnalyticsLabel>>

/**
 * `text` split into its words and its figures, filled from `figures` in `lang` (`null` while the answer is on its
 * way). An Arabic figure left blank reads its English: the figure is a machine value either way.
 */
export function fillTokens(text: string, figures: FilledFigures | null, lang: string): FigureSegment[] {
  const out: FigureSegment[] = []
  let at = 0
  for (const m of text.matchAll(FIGURE_TOKEN)) {
    const index = m.index ?? 0
    if (index > at) out.push({ kind: 'text', text: text.slice(at, index) })
    const token = m[0]
    const said = figures?.[token]
    const value = said ? (lang.startsWith('ar') && said.ar ? said.ar : said.en || said.ar) : ''
    out.push(!figures ? { kind: 'pending', token } : value ? { kind: 'figure', token, value } : { kind: 'missing', token })
    at = index + token.length
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) })
  return out
}

/** A single value a panel offers a text block: one of its measures over its whole selection, or over one named series. */
export interface PanelFigure {
  /** `measure`, or `measure:series`. */
  figure: string
  measure: string
  /** The series it is, or `null` for the panel's whole selection. */
  series: AnalyticsSeries | null
}

/**
 * The figures a panel offers (3408 §F, the server's validator): each of its measures over the panel's WHOLE
 * selection (one row, so a rate is Σ÷Σ, never an average of the rows); on a panel with named series, each
 * measure for each series instead, since there is no total across series. `_model` is kept for the callers: the
 * offer no longer depends on a measure's shape.
 */
export function figuresOf(definition: AnalyticsViewDefinition, _model?: AnalyticsModel): PanelFigure[] {
  const series = seriesOf(definition)
  // 861 (spec 3519 D15): a calculated key is a figure like a measure key, after the measures.
  const calculated = (definition.query.calculations ?? []).map((c) => c.key)
  const measures = [...definition.query.measures, ...calculated].filter((m) => m.trim() !== '')
  if (series.length > 0) return measures.flatMap((measure) => series.map((s) => ({ figure: figureOf(measure, s.id), measure, series: s })))
  return measures.map((measure) => ({ figure: measure, measure, series: null }))
}

// ── The designer's side (829): writing tokens, and the text ↔ chip round-trip ──────────────────────────────

/** The token naming one figure (`measure` or `measure:series`) of one panel: `{{fig:p2:orders:hs}}`. */
export const figureToken = (panel: string, figure: string): string => `{{fig:${panel}:${figure}}}`

/** A text block's words as the designer shows them: its words, and each live figure as a chip — never a raw token. */
export type ChipSegment = { kind: 'text'; text: string } | { kind: 'chip'; token: string; panel: string; figure: string }

/** `text` split into its words and its figure chips. `chipsText` puts it back exactly. */
export function chipSegments(text: string): ChipSegment[] {
  const out: ChipSegment[] = []
  let at = 0
  for (const m of text.matchAll(FIGURE_TOKEN)) {
    const index = m.index ?? 0
    if (index > at) out.push({ kind: 'text', text: text.slice(at, index) })
    out.push({ kind: 'chip', token: m[0], panel: m[1], figure: figureOf(m[2], m[3]) })
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
