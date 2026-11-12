import { create, type StoreApi } from 'zustand'
import { useBoardContext, type BoardContextState } from '@/core/board-context'
import { useReportContext, type ReportContextState } from '@/core/report-context'
import { useSession } from '@/core/session'
import { newRequestId } from '@/core/engine-session/request-id'
import type { CopilotAnswer, CopilotAskRequest, CopilotQuestionOrigin } from '@/core/models/copilot'
import { copilotApi } from './api'
import { copilotAnswerModel } from './answer'
import { EMPTY_CONVERSATION, askBody, boxOpen, canAskMore, pendingAsk, withAnswer, withRefusal, type AskFrom, type CopilotConversation } from './conversation'

/** A conversation filed in the history, with when it was left. */
export interface PastConversation {
  conv: CopilotConversation
  /** When it was filed (epoch ms). */
  at: number
}

/** The history keeps at most this many past conversations; the oldest falls off. */
export const COPILOT_HISTORY_MAX = 20

/** Files a conversation in the history: an empty one is not kept. */
export function filed(history: readonly PastConversation[], conv: CopilotConversation, at: number): PastConversation[] {
  if (conv.turns.length === 0) return [...history]
  return [{ conv, at }, ...history].slice(0, COPILOT_HISTORY_MAX)
}

/**
 * The copilot's conversation, held outside the panel (ticket 736): the top bar's sheet closes when an
 * answer's order link navigates, which unmounts the panel. Reopening it shows the same thread and
 * keeps the `conversationId`, because the turns and the id live here, not in the panel's state.
 *
 * The question in flight lives here too (review item 2), not in a panel's mutation: ONE ask at a time
 * for every mounted panel (the sheet and `/copilot` together), and a reply that arrives after its panel
 * unmounted still lands in the thread. A conversation cleared while a question was in flight ("New
 * conversation", or the user changing) drops that question's late reply: each clear moves `epoch` on.
 *
 * 🚩 Privacy: in memory only — never storage: a reload starts a new conversation. The session's user
 * changing (sign-out, a 401, another user) empties it too, as the sync console's replay draft does.
 *
 * The report in context (832, spec 819 §D): each ask sends the report open in the designer (`@/core/report-context`),
 * and a landed answer's `reportEdit` is posted back there with its question — the designer applies it as one undo
 * step. A reply to a cleared conversation posts nothing.
 *
 * History (CTO demo): "New conversation" files the one it leaves in `history`, most recent first, and `resume`
 * brings a past one back (filing the current one in its place). History follows the same privacy rule: memory only,
 * gone on reload or when the user changes. A resumed conversation keeps its id; if the server has let it expire, its
 * next question is refused with COPILOT-406 and the panel offers a new one, as for any conversation.
 */
export interface CopilotConversationState {
  conv: CopilotConversation
  /**
   * The question in flight, or null: at most one. `requestId` (ticket 869, BackOffice spec 3558 D17) is a fresh ULID per
   * question, sent on the ask; the panel polls its live steps while the question is in flight.
   */
  inFlight: { question: string; requestId: string } | null
  /** Moves on at every clear, so a reply to a cleared conversation is recognised and dropped. */
  epoch: number
  /**
   * Sends a question; `null` (nothing sent) while one is in flight or the conversation is closed. `origin` (871, A49)
   * says where it came from: typed unless said otherwise, `suggestion` for a tapped suggestion. A typed question while
   * an ask is pending (872, A37) is the reply to it: sent with the ask's id, the text as the reply.
   */
  ask: (question: string, origin?: CopilotQuestionOrigin) => Promise<void> | null
  /**
   * A tap on one of the pending ask's choices (872, BackOffice 3597): sends the choice's label as shown, with the ask's
   * id, the choice's key and `origin: 'choice'`. `null` (nothing sent) when no ask is pending or one is in flight.
   */
  choose: (choice: { key: string; label: string }) => Promise<void> | null
  /**
   * Stop: abandons the question in flight (the request is aborted, so the server stops working on it) and
   * hands it back, so the panel can put it in the box to change and send again. Its reply, if one still
   * arrives, is dropped; nothing is added to the thread. `null` when nothing is in flight.
   */
  stop: () => string | null
  /** "New conversation": no id, no thread, nothing in flight. The one left is filed in the history. */
  startNew: () => void
  /** Past conversations, most recent first. */
  history: PastConversation[]
  /** Brings the history's `index`th conversation back; the current one (if it holds turns) is filed instead. */
  resume: (index: number) => void
  /** Drops one past conversation from the history. */
  forget: (index: number) => void
}

export function createCopilotConversation(
  send: (body: CopilotAskRequest, signal?: AbortSignal) => Promise<CopilotAnswer>,
  now: () => number = () => Date.now(),
  reportBridge: StoreApi<ReportContextState> = useReportContext,
  boardBridge: StoreApi<BoardContextState> = useBoardContext,
) {
  /** The question in flight's abort, so Stop (and a clear) can end its request. */
  let aborter: AbortController | null = null
  const abandon = () => {
    aborter?.abort()
    aborter = null
  }
  const store = create<CopilotConversationState>((set, get) => ({
    conv: EMPTY_CONVERSATION,
    inFlight: null,
    epoch: 0,
    history: [],
    ask: (question, origin = 'typed') => {
      const pending = origin === 'typed' ? pendingAsk(get().conv) : null
      return put(question, pending ? { origin, askId: pending.ask.id } : { origin })
    },
    choose: (choice) => {
      const pending = pendingAsk(get().conv)
      if (pending === null) return null
      return put(choice.label, { origin: 'choice', askId: pending.ask.id, choiceKey: choice.key })
    },
    stop: () => {
      const { inFlight } = get()
      if (inFlight === null) return null
      abandon()
      set({ inFlight: null })
      return inFlight.question
    },
    startNew: () => {
      abandon()
      set((s) => ({ conv: EMPTY_CONVERSATION, inFlight: null, epoch: s.epoch + 1, history: filed(s.history, s.conv, now()) }))
    },
    resume: (index) =>
      set((s) => {
        const past = s.history[index]
        if (!past) return {}
        abandon()
        const rest = s.history.filter((_, i) => i !== index)
        return { conv: past.conv, inFlight: null, epoch: s.epoch + 1, history: filed(rest, s.conv, now()) }
      }),
    forget: (index) => set((s) => ({ history: s.history.filter((_, i) => i !== index) })),
  }))
  /** Sends one question, or a reply to the pending ask (`said.askId`): the one path a typed question, a tap and a reply take. */
  function put(question: string, said: Pick<AskFrom, 'origin' | 'askId' | 'choiceKey'>): Promise<void> | null {
    const get = store.getState
    const set = store.setState
    const { conv, inFlight, epoch } = get()
    // A reply to the pending ask is the same question: taken even when the conversation holds its tenth (872).
    if (inFlight !== null || !(said.askId ? boxOpen(conv) : canAskMore(conv)) || question.trim() === '') return null
    const requestId = newRequestId()
    set({ inFlight: { question, requestId } })
    const controller = new AbortController()
    aborter = controller
    // A reply to a cleared conversation, or to a question stopped, is dropped.
    const dropped = () => get().epoch !== epoch || controller.signal.aborted
    const landed = (next: (c: CopilotConversation) => CopilotConversation) => {
      if (dropped()) return
      if (aborter === controller) aborter = null
      set((s) => ({ conv: next(s.conv), inFlight: null }))
    }
    const from: AskFrom = { ...said, reportContext: reportBridge.getState().context, boardContext: boardBridge.getState().context }
    const body = { ...askBody(conv, question, from), requestId }
    return send(body, controller.signal).then(
      (reply) => {
        if (dropped()) return
        landed((c) => withAnswer(c, question, reply))
        const { reportEdit, boardEdit } = copilotAnswerModel(reply)
        if (reportEdit) reportBridge.getState().postEdit(reportEdit, question)
        if (boardEdit) boardBridge.getState().postEdit(boardEdit, question)
      },
      (err: unknown) => landed((c) => withRefusal(c, question, err)),
    )
  }
  useSession.subscribe((user, before) => {
    if (user.userId !== before.userId) abandon()
    if (user.userId !== before.userId) store.setState((s) => ({ conv: EMPTY_CONVERSATION, inFlight: null, epoch: s.epoch + 1, history: [] }))
  })
  return store
}

export const useCopilotConversation = createCopilotConversation((body, signal) => copilotApi.ask(body, signal))
