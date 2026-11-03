import type { CopilotAnswer, CopilotTraceEntry } from '@/core/models/copilot'

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
  }
}
