import { apiErrorCode } from '@/core/api'
import type { CopilotAnswer, CopilotAskRequest, CopilotBoardContext, CopilotQuestionOrigin, CopilotReportContext } from '@/core/models/copilot'

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
 * What travels with a question besides its text: where it came from (871, BackOffice 3598, A49: typed, a tapped
 * suggestion, and later a starter or an ask's choice), and what is open in context: (832) the report in the designer,
 * (836) the board in its editor.
 */
export interface AskFrom {
  origin?: CopilotQuestionOrigin
  reportContext?: CopilotReportContext | null
  boardContext?: CopilotBoardContext | null
}

/**
 * The `Copilot/Ask` body: the question, the conversation's id once it has one, the context open, and the origin. A
 * field with nothing to say is left out.
 */
export function askBody(c: CopilotConversation, question: string, from: AskFrom = {}): CopilotAskRequest {
  const { origin, reportContext, boardContext } = from
  const body: CopilotAskRequest = c.id ? { question, conversationId: c.id } : { question }
  return {
    ...body,
    ...(reportContext ? { reportContext } : {}),
    ...(boardContext ? { boardContext } : {}),
    ...(origin ? { origin } : {}),
  }
}

/**
 * An answer joins the thread. A reply in ANOTHER conversation than the one held (the server started a
 * new one) starts a fresh thread holding only that reply: the old turns are not this conversation's,
 * and their numbers would not be the server's count.
 */
export function withAnswer(c: CopilotConversation, question: string, reply: CopilotAnswer): CopilotConversation {
  const id = typeof reply?.conversationId === 'string' && reply.conversationId ? reply.conversationId : c.id
  const questionNo = typeof reply?.questionNo === 'number' ? reply.questionNo : null
  const turn: CopilotTurn = { question, questionNo, reply, refusal: null }
  if (c.id !== null && id !== c.id) return { id, turns: [turn], over: false }
  return { ...c, id, turns: [...c.turns, turn] }
}

export function withRefusal(c: CopilotConversation, question: string, err: unknown): CopilotConversation {
  return {
    ...c,
    over: c.over || apiErrorCode(err) === CONVERSATION_OVER,
    turns: [...c.turns, { question, questionNo: null, reply: null, refusal: err }],
  }
}

/**
 * The `index`th turn is the conversation's latest answer, and the conversation can take another question (871): only
 * then are its suggestions tappable. An earlier answer's, or any after a refused last question, are shown only.
 */
export function isLatestAnswer(c: CopilotConversation, index: number): boolean {
  return index === c.turns.length - 1 && c.turns[index].reply !== null && canAskMore(c)
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
