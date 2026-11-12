import { apiErrorCode } from '@/core/api'
import type { CopilotAnswer, CopilotAsk, CopilotAskRequest, CopilotBoardContext, CopilotQuestionOrigin, CopilotReportContext } from '@/core/models/copilot'

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
  /**
   * A reply to the pending ask (872, BackOffice 3597, A37): its id, and with a tap the chosen choice's key (the
   * `question` is then the choice's label as shown). A typed reply sends the id alone, the text as `question`.
   */
  askId?: string
  choiceKey?: string
}

/**
 * The `Copilot/Ask` body: the question, the conversation's id once it has one, the context open, and the origin. A
 * field with nothing to say is left out.
 */
export function askBody(c: CopilotConversation, question: string, from: AskFrom = {}): CopilotAskRequest {
  const { origin, reportContext, boardContext, askId, choiceKey } = from
  const body: CopilotAskRequest = c.id ? { question, conversationId: c.id } : { question }
  return {
    ...body,
    ...(reportContext ? { reportContext } : {}),
    ...(boardContext ? { boardContext } : {}),
    ...(origin ? { origin } : {}),
    ...(askId ? { askId, ...(choiceKey ? { choiceKey } : {}) } : {}),
  }
}

/**
 * The ask a reply would answer (872, BackOffice 3597): the latest ANSWER's, when its outcome is `asked` and it can be
 * replied to (it carries an id, and the conversation one). A refused reply after it leaves it pending, as the server
 * does; a later answer (its continuation, or a new question) ends it, and so does a closed conversation.
 */
export function pendingAsk(c: CopilotConversation): { index: number; ask: CopilotAsk } | null {
  if (c.over || !c.id) return null
  for (let i = c.turns.length - 1; i >= 0; i--) {
    const reply = c.turns[i].reply
    if (reply === null) continue
    const ask = reply.outcome === 'asked' ? reply.ask : undefined
    return ask && typeof ask.id === 'string' && ask.id !== '' ? { index: i, ask } : null
  }
  return null
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
 * The `index`th turn's choices can be tapped (872, A40): its ask is the one pending. Once its continuation is answered,
 * or a new question is, or the conversation closes, they are shown only.
 */
export function choicesTappable(c: CopilotConversation, index: number): boolean {
  return pendingAsk(c)?.index === index
}

/**
 * What can be tapped on the `index`th turn — the ONE place the panel asks (3586 review item 8): its suggestions only on
 * the latest answer of a conversation that can take another question, its choices only while its ask is pending; and
 * neither while a question is in flight (`working`). The answer's parts draw buttons; this says whether they tap.
 */
export function turnTaps(c: CopilotConversation, index: number, working: boolean): { suggestions: boolean; choices: boolean } {
  return {
    suggestions: !working && isLatestAnswer(c, index),
    choices: !working && choicesTappable(c, index),
  }
}

/**
 * The `index`th turn continues an asked question (872, BackOffice 3597, A38): it was answered with the same number as the
 * answer before it, which asked. The two are one question. A reply the server took as a new question (its ask had gone)
 * has the next number, or a new conversation, and is not one.
 */
export function continuesAsk(c: CopilotConversation, index: number): boolean {
  const turn = c.turns[index]
  if (!turn?.reply || turn.questionNo === null) return false
  for (let i = index - 1; i >= 0; i--) {
    const before = c.turns[i]
    if (before.reply === null) continue
    return before.reply.outcome === 'asked' && before.questionNo === turn.questionNo
  }
  return false
}

/** The conversation's questions, as the panel counts them (872): an asked question and its continuation count once. */
export function questionCount(c: CopilotConversation): number {
  return c.turns.filter((_, i) => !continuesAsk(c, i)).length
}

/**
 * The question box is shown (872, A37): the conversation can take another question, or an ask is pending, whose reply
 * is the same question (even the tenth's). With no choices the box is how the reader types the name again.
 */
export function boxOpen(c: CopilotConversation): boolean {
  return canAskMore(c) || pendingAsk(c) !== null
}

/**
 * The conversation can take another question: not refused with 406, and the server's own `questionNo` not yet at
 * ten. The limit is read from the server's numbers, never from counting turns — the server is the authority. (The
 * panel does count questions for display, `questionCount`, and tells an ask's continuation apart, `continuesAsk`;
 * neither decides whether one more can be asked.)
 */
export function canAskMore(c: CopilotConversation): boolean {
  if (c.over) return false
  const last = c.turns.reduce((n, t) => Math.max(n, t.questionNo ?? 0), 0)
  return last < COPILOT_MAX_QUESTIONS
}
