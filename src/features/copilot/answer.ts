import { itemHref } from '@/core/analytics-routes'
import type { CopilotAnswer, CopilotReportRef, CopilotTraceEntry, CopilotViewRef } from '@/core/models/copilot'

/**
 * The copilot answer's view model (ticket 735, spec 734 D10/D11) — the one pure seam between the
 * `Copilot/Ask` reply and the panel. A field the reply lacks is read as empty, so a bare answer
 * never crashes the panel.
 */

/** The question box's limit (D7); the server refuses longer with `COPILOT-405`. */
export const COPILOT_MAX_QUESTION = 1000

/** A question can be sent: not blank, and within the limit. */
export function questionFits(question: string): boolean {
  return question.trim().length > 0 && question.length <= COPILOT_MAX_QUESTION
}

/** The light markdown the answer may carry (D10): paragraphs, bullet lists and simple tables only. */
export type AnswerBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }

export interface CopilotAnswerModel {
  conversationId: string | null
  questionNo: number | null
  blocks: AnswerBlock[]
  orderRefs: string[]
  trace: CopilotTraceEntry[]
  stoppedEarly: boolean
  /** The provider and model that served the answer (D4), or `null` when the reply lacks it. */
  servedBy: string | null
  /** The views the answer created (spec 766 D), each an "Open view" link; absent reads as empty. */
  viewRefs: CopilotViewRef[]
  /** The reports the answer built or revised (CTO demo). */
  reportRefs: CopilotReportRef[]
  /** The house rules it was answered under (ticket 790): `rules vN`, the built-in rules, or not known. */
  rules: AnswerRules | null
}

/** `promptVersion` read: a saved version, or 0, the built-in fallback. */
export type AnswerRules = { kind: 'version'; n: number } | { kind: 'builtIn' }

function rulesOf(v: unknown): AnswerRules | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return null
  return v === 0 ? { kind: 'builtIn' } : { kind: 'version', n: v }
}

const BULLET = /^\s*[-*•]\s+/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_RULE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())

/** Splits the answer text into blocks. Anything that is not a list or a table is a paragraph. */
export function answerBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
    } else if (BULLET.test(line)) {
      const items: string[] = []
      while (i < lines.length && BULLET.test(lines[i])) items.push(lines[i++].replace(BULLET, '').trim())
      blocks.push({ kind: 'list', items })
    } else if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
      const head = cells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(cells(lines[i++]))
      blocks.push({ kind: 'table', head, rows })
    } else {
      const para: string[] = []
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !BULLET.test(lines[i]) &&
        !(TABLE_ROW.test(lines[i]) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1]))
      )
        para.push(lines[i++].trim())
      blocks.push({ kind: 'paragraph', text: para.join('\n') })
    }
  }
  return blocks
}

export function copilotAnswerModel(reply: Partial<CopilotAnswer> | null | undefined): CopilotAnswerModel {
  const r = reply ?? {}
  return {
    conversationId: typeof r.conversationId === 'string' ? r.conversationId : null,
    questionNo: typeof r.questionNo === 'number' ? r.questionNo : null,
    blocks: typeof r.answer === 'string' ? answerBlocks(r.answer) : [],
    orderRefs: Array.isArray(r.orderRefs) ? r.orderRefs.filter((x): x is string => typeof x === 'string') : [],
    trace: Array.isArray(r.trace) ? r.trace : [],
    stoppedEarly: r.stoppedEarly === true,
    servedBy: typeof r.servedBy === 'string' && r.servedBy.trim() !== '' ? r.servedBy : null,
    viewRefs: Array.isArray(r.viewRefs) ? r.viewRefs.flatMap(viewRef) : [],
    reportRefs: Array.isArray(r.reportRefs) ? r.reportRefs.flatMap(reportRef) : [],
    rules: rulesOf(r.promptVersion),
  }
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

/** One `viewRefs` entry, or none when it carries no id. A missing title half reads as blank. */
function viewRef(v: unknown): CopilotViewRef[] {
  if (!v || typeof v !== 'object') return []
  const { id, title } = v as { id?: unknown; title?: unknown }
  const key = typeof id === 'string' ? id : typeof id === 'number' && Number.isFinite(id) ? String(id) : ''
  if (key.trim() === '') return []
  const t = title && typeof title === 'object' ? (title as { en?: unknown; ar?: unknown }) : {}
  return [{ id: key, title: { en: text(t.en), ar: text(t.ar) } }]
}

/** One `reportRefs` entry, or none when it carries no id. */
function reportRef(v: unknown): CopilotReportRef[] {
  if (!v || typeof v !== 'object') return []
  const { id, title, revision } = v as { id?: unknown; title?: unknown; revision?: unknown }
  if (typeof id !== 'string' || id.trim() === '') return []
  return [{ id, title: text(title), revision: typeof revision === 'number' ? revision : 1 }]
}

/** The view a `viewRefs` entry opens — by route string only; the copilot never imports analytics. */
export const viewHref = (id: string) => itemHref('view', id)

/** A piece of answer text: plain, or an order number that links to its delivery document (D11). */
export type AnswerSegment = { kind: 'text'; text: string } | { kind: 'order'; no: string }

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Splits answer text so every `orderRefs` number in it becomes an `order` segment, wherever it
 * appears (ticket 736). A ref matches only as a whole number — never inside a longer run of letters
 * or digits — and the longest ref wins where two could start at the same place.
 */
export function orderSegments(text: string, orderRefs: readonly string[]): AnswerSegment[] {
  if (text === '') return []
  const refs = [...new Set(orderRefs.filter((r) => r.trim() !== ''))].sort((a, b) => b.length - a.length)
  if (refs.length === 0) return [{ kind: 'text', text }]
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${refs.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'gu')
  const out: AnswerSegment[] = []
  let at = 0
  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0
    if (start > at) out.push({ kind: 'text', text: text.slice(at, start) })
    out.push({ kind: 'order', no: m[0] })
    at = start + m[0].length
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) })
  return out
}

/** The delivery document an order ref opens: the delivery route, as the dispatch screens link it. */
export const orderHref = (no: string) => `/oms/delivery/${encodeURIComponent(no)}`
