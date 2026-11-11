import { create, type StoreApi } from 'zustand'
import { useBoardContext, type BoardContextState } from '@/core/board-context'
import { useReportContext, type ReportContextState } from '@/core/report-context'
import { useSession } from '@/core/session'
import { newRequestId } from '@/core/engine-session/request-id'
import type { CopilotAnswer, CopilotAskRequest } from '@/core/models/copilot'
import { copilotApi } from './api'
import { copilotAnswerModel } from './answer'
import { EMPTY_CONVERSATION, askBody, canAskMore, withAnswer, withRefusal, type CopilotConversation, type TurnConfirms } from './conversation'
import { cancellationBody, confirmationBody, type CardValues, type ProposalCard } from './proposal'

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
  inFlight: { question: string; requestId: string; confirms?: TurnConfirms } | null
  /** Moves on at every clear, so a reply to a cleared conversation is recognised and dropped. */
  epoch: number
  /** Sends a question; `null` (nothing sent) while one is in flight or the conversation is closed. */
  ask: (question: string) => Promise<void> | null
  /**
   * 885 (BackOffice 3664): Confirm a proposal's card with its values. Not a question: it lands as a turn marked
   * `confirms`, and is sent even at the conversation's tenth question (it takes none). Resolves to the reply (null on a
   * refusal or a dropped reply); `null` (nothing sent) while something is in flight, with no conversation, or once it
   * is over.
   */
  confirm: (card: ProposalCard, values: CardValues) => Promise<CopilotAnswer | null> | null
  /** 885: Cancel a proposal's card, as `confirm`. */
  cancel: (card: ProposalCard) => Promise<CopilotAnswer | null> | null
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
  const store = create<CopilotConversationState>((set, get) => {
    /** Sends one request and lands its reply (or refusal) as a turn: the reply, or null when refused or dropped. */
    const run = (body: CopilotAskRequest, question: string, confirms?: TurnConfirms): Promise<CopilotAnswer | null> => {
      const { epoch } = get()
      const requestId = newRequestId()
      set({ inFlight: { question, requestId, ...(confirms ? { confirms } : {}) } })
      const controller = new AbortController()
      aborter = controller
      // A reply to a cleared conversation, or to a question stopped, is dropped.
      const dropped = () => get().epoch !== epoch || controller.signal.aborted
      const landed = (next: (c: CopilotConversation) => CopilotConversation) => {
        if (dropped()) return
        if (aborter === controller) aborter = null
        set((s) => ({ conv: next(s.conv), inFlight: null }))
      }
      return send({ ...body, requestId }, controller.signal).then(
        (reply) => {
          if (dropped()) return null
          landed((c) => withAnswer(c, question, reply, confirms))
          const { reportEdit, boardEdit } = copilotAnswerModel(reply)
          if (reportEdit) reportBridge.getState().postEdit(reportEdit, question)
          if (boardEdit) boardBridge.getState().postEdit(boardEdit, question)
          return reply
        },
        (err: unknown) => {
          landed((c) => withRefusal(c, question, err, confirms))
          return null
        },
      )
    }
    /** A confirmation needs the conversation the proposal was made in, still open, and nothing in flight. */
    const openConversation = (): string | null => {
      const { conv, inFlight } = get()
      return inFlight === null && conv.id !== null && !conv.over ? conv.id : null
    }
    return {
      conv: EMPTY_CONVERSATION,
      inFlight: null,
      epoch: 0,
      history: [],
      ask: (question) => {
        const { conv, inFlight } = get()
        if (inFlight !== null || !canAskMore(conv) || question.trim() === '') return null
        return run(askBody(conv, question, reportBridge.getState().context, boardBridge.getState().context), question).then(() => undefined)
      },
      confirm: (card, values) => {
        const id = openConversation()
        return id === null ? null : run(confirmationBody(id, card, values), '', { proposalId: card.id, cancel: false })
      },
      cancel: (card) => {
        const id = openConversation()
        return id === null ? null : run(cancellationBody(id, card), '', { proposalId: card.id, cancel: true })
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
    }
  })
  useSession.subscribe((user, before) => {
    if (user.userId !== before.userId) abandon()
    if (user.userId !== before.userId) store.setState((s) => ({ conv: EMPTY_CONVERSATION, inFlight: null, epoch: s.epoch + 1, history: [] }))
  })
  return store
}

export const useCopilotConversation = createCopilotConversation((body, signal) => copilotApi.ask(body, signal))
