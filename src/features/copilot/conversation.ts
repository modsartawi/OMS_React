import { apiErrorCode } from '@/core/api'
import type { CopilotAnswer, CopilotAskRequest, CopilotBoardContext, CopilotReportContext, CopilotStatedReading } from '@/core/models/copilot'

/**
 * The copilot conversation (ticket 737, spec 734 D5) — the panel's thread, as one pure value.
 *
 * Each answer carries its `conversationId`; a follow-up sends it back so SIS.Api answers in context.
 * A conversation holds at most ten questions, and the server refuses a stale or full one with
 * `COPILOT-406`. Past either, the panel offers a new conversation instead of the question box.
 * "New conversation" is `EMPTY_CONVERSATION`: no id, no thread.
 */

/** D5: a conversation holds at most this many questions. */
export const COPILOT_MAX_QUESTIONS = 10

/** The refusal code for a conversation that expired or is full (D7). */
export const CONVERSATION_OVER = 'COPILOT-406'

/** One question in the thread, answered (`reply`) or refused (`refusal`, the `ApiError`). */
export interface CopilotTurn {
  question: string
  /** The server's number for an answered question (1–10); null for a refused one. */
  questionNo: number | null
  reply: CopilotAnswer | null
  refusal: unknown
  /**
   * 885 (BackOffice 3664): this turn is not a question but the Confirm or Cancel of a proposal's card; `question` is
   * then `''`. Absent on a question.
   */
  confirms?: TurnConfirms
}

/** What a confirmation turn answered: the proposal it named, and whether it was a cancel. */
export interface TurnConfirms {
  proposalId: string
  cancel: boolean
}

export interface CopilotConversation {
  /** The id follow-ups send back; null until the first answer. */
  id: string | null
  turns: CopilotTurn[]
  /** A `COPILOT-406` closed it: the server will not take another question in it. */
  over: boolean
}

export const EMPTY_CONVERSATION: CopilotConversation = Object.freeze({ id: null, turns: [], over: false }) as CopilotConversation

/**
 * The `Copilot/Ask` body: the question, the conversation's id once it has one, and (832) the report open in the
 * designer when one is published, (836) the board open in its editor, and (892) the reading a tapped assumption line
 * states: the tapped answer's question, asked again. 888 (spec 3632 Q27): `sqlMode: true` when the question is asked in
 * SQL mode, and nothing otherwise; Q46: with it, `sqlItemContext` on the question opening a SQL item.
 */
export function askBody(
  c: CopilotConversation,
  question: string,
  reportContext: CopilotReportContext | null = null,
  boardContext: CopilotBoardContext | null = null,
  sqlMode = false,
  sqlItemContext: { itemId: string } | null = null,
  statedReading: CopilotStatedReading | null = null,
): CopilotAskRequest {
  const body: CopilotAskRequest = c.id ? { question, conversationId: c.id } : { question }
  return {
    ...body,
    ...(reportContext ? { reportContext } : {}),
    ...(boardContext ? { boardContext } : {}),
    ...(sqlMode ? { sqlMode: true } : {}),
    ...(sqlMode && sqlItemContext ? { sqlItemContext } : {}),
    ...(statedReading ? { statedReading } : {}),
  }
}

/**
 * An answer joins the thread. A reply in ANOTHER conversation than the one held (the server started a
 * new one) starts a fresh thread holding only that reply: the old turns are not this conversation's,
 * and their numbers would not be the server's count.
 */
export function withAnswer(c: CopilotConversation, question: string, reply: CopilotAnswer, confirms?: TurnConfirms): CopilotConversation {
  const id = typeof reply?.conversationId === 'string' && reply.conversationId ? reply.conversationId : c.id
  const questionNo = typeof reply?.questionNo === 'number' ? reply.questionNo : null
  const turn: CopilotTurn = { question, questionNo, reply, refusal: null, ...(confirms ? { confirms } : {}) }
  if (c.id !== null && id !== c.id) return { id, turns: [turn], over: false }
  return { ...c, id, turns: [...c.turns, turn] }
}

export function withRefusal(c: CopilotConversation, question: string, err: unknown, confirms?: TurnConfirms): CopilotConversation {
  return {
    ...c,
    over: c.over || apiErrorCode(err) === CONVERSATION_OVER,
    turns: [...c.turns, { question, questionNo: null, reply: null, refusal: err, ...(confirms ? { confirms } : {}) }],
  }
}

/**
 * The box stays while the conversation can take another question: not refused with 406, and the server's
 * own `questionNo` not yet at ten. The client never counts turns itself — the server is the authority.
 */
export function canAskMore(c: CopilotConversation): boolean {
  if (c.over) return false
  const last = c.turns.reduce((n, t) => Math.max(n, t.questionNo ?? 0), 0)
  return last < COPILOT_MAX_QUESTIONS
}
