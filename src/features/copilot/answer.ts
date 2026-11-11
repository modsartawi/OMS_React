import { itemHref } from '@/core/analytics-routes'
import type { AnalyticsLabel } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import type {
  CopilotAnswer,
  CopilotAnswerTable,
  CopilotAssumptionChoice,
  CopilotBoardEdit,
  CopilotNamedSetKind,
  CopilotNamedSetProposal,
  CopilotOwnReadingKind,
  CopilotReadingOffer,
  CopilotReportEdit,
  CopilotReportRef,
  CopilotReportStep,
  CopilotTraceEntry,
  CopilotViewRef,
} from '@/core/models/copilot'

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

/**
 * The light markdown the answer may carry (D10): paragraphs, headings, bullet and numbered lists and simple
 * tables. Inside any text, `**bold**`, `*italic*` and `` `code` `` are read by `inlineMarks`, so a model that
 * bolds a table cell never shows its asterisks.
 */
export type AnswerBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[]; ordered?: true }
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
  /** The reports the answer built or saved (spec 819 §D), each an "Open in designer" link; absent reads as empty. */
  reportRefs: CopilotReportRef[]
  /** The unsaved edit for the report open in the designer (832), handed to it through the core bridge; or none. */
  reportEdit: CopilotReportEdit | null
  /** The unsaved edit for the board open in its editor (836), handed to it through the core bridge; or none. */
  boardEdit: CopilotBoardEdit | null
  /** What the report assumed, one line each (802 item 1); absent reads as empty. */
  assumptions: AnalyticsLabel[]
  /**
   * BackOffice 3685 (892): beside each of `assumptions`, the other readings its line offers, or `null` (not tappable).
   * Re-indexed from the wire's `line` (an index into the assumptions AS SENT) onto the lines kept.
   */
  assumptionChoices: (CopilotAssumptionChoice | null)[]
  /** BackOffice 3686 (892): the offer to keep a reading under this answer, or none. */
  readingOffer: CopilotReadingOffer | null
  /** BackOffice 3687 (893): the named set proposed in this answer, or none. */
  namedSet: CopilotNamedSetProposal | null
  /** The house rules it was answered under (ticket 790): `rules vN`, the built-in rules, or not known. */
  rules: AnswerRules | null
  /**
   * The tables to draw under the summary (ticket 868, spec 3558 D5), in the order sent; absent or empty reads as none,
   * and the answer renders as before.
   */
  tables: CopilotAnswerTable[]
  /**
   * The outcome was `figures-only` (BackOffice 3590, ticket 870): the text is the server's fixed sentence, none of the
   * model's words, and the answer is its tables and its lookups. Not an error.
   */
  figuresOnly: boolean
}

/** `promptVersion` read: a saved version, or 0, the built-in fallback. */
export type AnswerRules = { kind: 'version'; n: number } | { kind: 'builtIn' }

function rulesOf(v: unknown): AnswerRules | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return null
  return v === 0 ? { kind: 'builtIn' } : { kind: 'version', n: v }
}

const BULLET = /^\s*[-*•]\s+/
const NUMBERED = /^\s*\d{1,3}[.)]\s+/
const HEADING = /^\s*#{1,6}\s+/
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
    } else if (HEADING.test(line)) {
      blocks.push({ kind: 'heading', text: lines[i++].replace(HEADING, '').replace(/\s*#+\s*$/, '').trim() })
    } else if (BULLET.test(line)) {
      const items: string[] = []
      while (i < lines.length && BULLET.test(lines[i])) items.push(lines[i++].replace(BULLET, '').trim())
      blocks.push({ kind: 'list', items })
    } else if (NUMBERED.test(line)) {
      const items: string[] = []
      while (i < lines.length && NUMBERED.test(lines[i])) items.push(lines[i++].replace(NUMBERED, '').trim())
      blocks.push({ kind: 'list', items, ordered: true })
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
        !NUMBERED.test(lines[i]) &&
        !HEADING.test(lines[i]) &&
        !(TABLE_ROW.test(lines[i]) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1]))
      )
        para.push(lines[i++].trim())
      blocks.push({ kind: 'paragraph', text: para.join('\n') })
    }
  }
  return blocks
}

/**
 * The answer as clean text for Copy: no markdown marks, one blank line between blocks, lists as `- ` or `1. `, and a
 * table as tab-separated rows, so it pastes into a message as read and into a spreadsheet as cells.
 */
export function answerPlainText(blocks: readonly AnswerBlock[]): string {
  const plain = (s: string) => inlineMarks(s).map((m) => m.text).join('')
  return blocks
    .map((b) => {
      if (b.kind === 'list') return b.items.map((item, i) => (b.ordered ? `${i + 1}. ` : '- ') + plain(item)).join('\n')
      if (b.kind === 'table') return [b.head, ...b.rows].map((row) => row.map(plain).join('\t')).join('\n')
      return plain(b.text)
    })
    .join('\n\n')
}

/** A run of answer text and its inline mark. */
export type InlineMark = { text: string; mark: 'strong' | 'em' | 'code' | null }

const INLINE = /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|(?<![\p{L}\p{N}*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\p{L}\p{N}*])/gu

/**
 * Splits a piece of answer text on its inline marks: `` `code` ``, `**bold**` / `__bold__` and `*italic*`. A lone
 * asterisk (`5 * 3`, a footnote `*`) is not a mark and stays as written.
 */
export function inlineMarks(text: string): InlineMark[] {
  const out: InlineMark[] = []
  let at = 0
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0
    if (start > at) out.push({ text: text.slice(at, start), mark: null })
    if (m[1] !== undefined) out.push({ text: m[1], mark: 'code' })
    else if (m[2] !== undefined || m[3] !== undefined) out.push({ text: (m[2] ?? m[3]) as string, mark: 'strong' })
    else out.push({ text: m[4], mark: 'em' })
    at = start + m[0].length
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: null })
  return out
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
    reportEdit: reportEditOf(r.reportEdit),
    boardEdit: boardEditOf(r.boardEdit),
    ...assumptionsOf(r.assumptions, r.assumptionChoices),
    readingOffer: readingOfferOf(r.readingOffer),
    namedSet: namedSetOf(r.namedSet),
    rules: rulesOf(r.promptVersion),
    tables: Array.isArray(r.tables) ? r.tables.filter(isTable) : [],
    figuresOnly: r.outcome === 'figures-only',
  }
}

/** A part the panel draws under the answer's text, in this order; the provenance (stop note, lookups, footer) follows. */
export type AnswerPart = 'text' | 'tables' | 'views' | 'assumptions' | 'readingOffer' | 'namedSet' | 'reportEdit' | 'boardEdit' | 'reports'

/** How the list of lookups ("How I got this") is drawn: not at all (no trace), folded, or open. */
export type AnswerLookups = 'none' | 'collapsed' | 'open'

export interface AnswerLayout {
  figuresOnly: boolean
  parts: AnswerPart[]
  lookups: AnswerLookups
}

/** What the panel draws for one answer, in order: only the parts the answer has. */
export function answerLayout(model: CopilotAnswerModel): AnswerLayout {
  const parts: AnswerPart[] = ['text']
  if (model.tables.length > 0) parts.push('tables')
  if (model.viewRefs.length > 0) parts.push('views')
  if (model.assumptions.length > 0) parts.push('assumptions')
  if (model.readingOffer) parts.push('readingOffer')
  if (model.namedSet) parts.push('namedSet')
  if (model.reportEdit) parts.push('reportEdit')
  if (model.boardEdit) parts.push('boardEdit')
  if (model.reportRefs.length > 0) parts.push('reports')
  // A figures-only answer's sentence says the lookups are listed below: they start open.
  const lookups: AnswerLookups = model.trace.length === 0 ? 'none' : model.figuresOnly ? 'open' : 'collapsed'
  return { figuresOnly: model.figuresOnly, parts, lookups }
}

/**
 * What the answer assumed (802 item 1; BackOffice 3594, ticket 870), one line each in the panel's language: a report's,
 * or the server's for any other answer. A line missing in that language reads the other one.
 */
export const assumptionLines = (assumptions: readonly AnalyticsLabel[], lang: string): string[] => assumptions.map((a) => saysIn(a, lang))

/** One assumption line as drawn (892): its words, and the other readings a tap offers (`null`: a plain line). */
export interface AssumptionRow {
  text: string
  choice: { kind: CopilotOwnReadingKind; value: string | null; choices: { value: string; text: string }[] } | null
}

/** The assumption lines in the panel's language, each with what a tap on it offers. A line's words are the server's, as sent. */
export function assumptionRows(model: Pick<CopilotAnswerModel, 'assumptions' | 'assumptionChoices'>, lang: string): AssumptionRow[] {
  return model.assumptions.map((a, i) => {
    const c = model.assumptionChoices[i] ?? null
    return {
      text: saysIn(a, lang),
      choice: c ? { kind: c.kind, value: c.value, choices: c.choices.map((x) => ({ value: x.value, text: saysIn(x.label, lang) })) } : null,
    }
  })
}

/**
 * A table's key among the answer's tables (878): its step AND its place. An analysis result gives one table per part,
 * all on one step (BackOffice 3621), so the step alone is no key.
 */
export const answerTableKey = (table: CopilotAnswerTable, index: number): string => `${table.step}-${index}`

/** A table the panel can draw: an object with its columns and rows as lists. Anything else is left out. */
const isTable = (v: unknown): v is CopilotAnswerTable =>
  !!v && typeof v === 'object' && Array.isArray((v as { columns?: unknown }).columns) && Array.isArray((v as { rows?: unknown }).rows)

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

/** A `{ en, ar }` pair, a missing or odd half read as blank. */
const bilingual = (v: unknown): AnalyticsLabel => {
  const t = v && typeof v === 'object' ? (v as { en?: unknown; ar?: unknown }) : {}
  return { en: text(t.en), ar: text(t.ar) }
}

const READING_KINDS: readonly string[] = ['period', 'comparison', 'scope', 'money-base'] satisfies CopilotOwnReadingKind[]
const readingKind = (v: unknown): v is CopilotOwnReadingKind => typeof v === 'string' && READING_KINDS.includes(v)
const said = (l: AnalyticsLabel): boolean => l.en.trim() !== '' || l.ar.trim() !== ''

/**
 * The assumption lines kept (blank ones dropped) and, beside each, its choices (3685). An entry naming no line, an unknown
 * kind, or no choice with a value is left out: that line is drawn plain.
 */
function assumptionsOf(raw: unknown, rawChoices: unknown): Pick<CopilotAnswerModel, 'assumptions' | 'assumptionChoices'> {
  if (!Array.isArray(raw)) return { assumptions: [], assumptionChoices: [] }
  const byLine = new Map<number, CopilotAssumptionChoice>()
  for (const c of Array.isArray(rawChoices) ? (rawChoices as unknown[]) : []) {
    if (!c || typeof c !== 'object') continue
    const { line, kind, value, choices } = c as Record<string, unknown>
    if (typeof line !== 'number' || !Number.isInteger(line) || !readingKind(kind) || !Array.isArray(choices)) continue
    const list = choices.flatMap((x) => {
      const o = x && typeof x === 'object' ? (x as { value?: unknown; label?: unknown }) : {}
      return typeof o.value === 'string' && o.value.trim() !== '' ? [{ value: o.value, label: bilingual(o.label) }] : []
    })
    if (list.length > 0) byLine.set(line, { line, kind, value: typeof value === 'string' ? value : null, choices: list })
  }
  const kept = raw.map((a, line) => ({ label: bilingual(a), choice: byLine.get(line) ?? null })).filter((a) => said(a.label))
  return { assumptions: kept.map((a) => a.label), assumptionChoices: kept.map((a) => a.choice) }
}

/** The named-set card as drawn (893): the name as the server gave it, and every member in order in the panel's language. */
export interface NamedSetCard {
  name: string
  members: { key: string; kind: CopilotNamedSetKind; text: string }[]
}

export const namedSetCard = (set: CopilotNamedSetProposal, lang: string): NamedSetCard => ({
  name: set.name,
  members: set.members.map((m) => ({ key: m.key, kind: m.kind, text: saysIn(m.label, lang) })),
})

const SET_KINDS: readonly string[] = ['store', 'city', 'region', 'channel'] satisfies CopilotNamedSetKind[]
const setKind = (v: unknown): v is CopilotNamedSetKind => typeof v === 'string' && SET_KINDS.includes(v)

/** The proposed named set (3687), or none when it lacks its id, its name, a known kind or a member with a key. */
function namedSetOf(v: unknown): CopilotNamedSetProposal | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id.trim() === '' || typeof o.name !== 'string' || o.name.trim() === '' || !setKind(o.kind)) return null
  const members = (Array.isArray(o.members) ? (o.members as unknown[]) : []).flatMap((x) => {
    const m = x && typeof x === 'object' ? (x as Record<string, unknown>) : {}
    return typeof m.key === 'string' && m.key.trim() !== '' && setKind(m.kind) ? [{ key: m.key, kind: m.kind, label: bilingual(m.label) }] : []
  })
  if (members.length === 0) return null
  return { id: o.id, name: o.name, kind: o.kind, members, offer: bilingual(o.offer) }
}

/** The offer to keep a reading (3686), or none when it lacks its id, a known kind, a value or its words. */
function readingOfferOf(v: unknown): CopilotReadingOffer | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id.trim() === '' || !readingKind(o.kind) || typeof o.value !== 'string') return null
  const offer = bilingual(o.offer)
  if (!said(offer)) return null
  return { id: o.id, kind: o.kind, value: o.value, label: bilingual(o.label), offer }
}

/** One `reportRefs` entry, or none when it carries no id. An absent revision reads as 1 (a new report). */
function reportRef(v: unknown): CopilotReportRef[] {
  if (!v || typeof v !== 'object') return []
  const { id, title, revision, nextSteps } = v as { id?: unknown; title?: unknown; revision?: unknown; nextSteps?: unknown }
  if (typeof id !== 'string' || id.trim() === '') return []
  const ref: CopilotReportRef = { id, revision: typeof revision === 'number' && Number.isInteger(revision) && revision > 0 ? revision : 1, title: bilingual(title) }
  // 819 §D: only Share and Schedule are linked, each once, Share first.
  const steps = Array.isArray(nextSteps) ? REPORT_STEPS.filter((s) => nextSteps.includes(s)) : []
  return [steps.length ? { ...ref, nextSteps: steps } : ref]
}

const REPORT_STEPS: readonly CopilotReportStep[] = ['share', 'schedule']

/** `reportEdit`, or none when it names no report (`null` is the unsaved one in context) or carries no definition with sections (the designer's shape). */
function reportEditOf(v: unknown): CopilotReportEdit | null {
  if (!v || typeof v !== 'object') return null
  const { reportId, definition, note } = v as { reportId?: unknown; definition?: unknown; note?: unknown }
  // `null` is the unsaved new report in context (story 101, ⚠ proposed); a missing or blank id is no edit.
  if (reportId !== null && (typeof reportId !== 'string' || reportId.trim() === '')) return null
  if (!definition || typeof definition !== 'object' || !Array.isArray((definition as { sections?: unknown }).sections)) return null
  const d = definition as CopilotReportEdit['definition']
  return { reportId, definition: { ...d, params: Array.isArray(d.params) ? d.params : [], bindings: d.bindings && typeof d.bindings === 'object' ? d.bindings : {} }, note: bilingual(note) }
}

/** `boardEdit` (836, BackOffice 3430), or none when it names no board or carries no definition with panels (the editor's shape). */
function boardEditOf(v: unknown): CopilotBoardEdit | null {
  if (!v || typeof v !== 'object') return null
  const { boardId, definition, note } = v as { boardId?: unknown; definition?: unknown; note?: unknown }
  if (typeof boardId !== 'string' || boardId.trim() === '') return null
  if (!definition || typeof definition !== 'object' || !Array.isArray((definition as { panels?: unknown }).panels)) return null
  const d = definition as CopilotBoardEdit['definition']
  return { boardId, definition: { ...d, params: Array.isArray(d.params) ? d.params : [], bindings: d.bindings && typeof d.bindings === 'object' ? d.bindings : {} }, note: bilingual(note) }
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
