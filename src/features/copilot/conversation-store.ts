import { create, type StoreApi } from 'zustand'
import { useBoardContext, type BoardContextState } from '@/core/board-context'
import { useReportContext, type ReportContextState } from '@/core/report-context'
import { useSession } from '@/core/session'
import { newRequestId } from '@/core/engine-session/request-id'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { AnalyticsLabel } from '@/core/models/analytics'
import type { CopilotAnswer, CopilotAskRequest, CopilotQuestionOrigin, CopilotSqlItemRef, CopilotSqlOffer, CopilotStatedReading } from '@/core/models/copilot'
import { copilotApi, copilotNamedSetApi, copilotReadingApi, type CopilotNamedSetDoors, type CopilotReadingDoors } from './api'
import { copilotAnswerModel } from './answer'
import { EMPTY_CONVERSATION, askBody, boxOpen, canAskMore, pendingAsk, withAnswer, withRefusal, type AskFrom, type CopilotConversation, type TurnConfirms } from './conversation'
import { cancellationBody, confirmationBody, type CardValues, type ProposalCard } from './proposal'

/**
 * Where an offer to keep a reading stands (892, BackOffice 3686): `open` with its buttons, `busy` while Keep or Not now
 * runs, `kept` (the server's confirmation line replaces the buttons), `dismissed` (Not now: the line is hidden), `closed`
 * (refused `COPILOT-437`/`COPILOT-430`: the words stay, the buttons go, the refusal's message beside them), `failed`
 * (anything else: the buttons stay to try again). The named-set card (893, BackOffice 3687) shares these states, keyed by
 * its proposal id, and adds `full` (refused `COPILOT-434`: the reader keeps 10 sets; the message beside the way to the
 * page, and Keep stays to try again after a delete).
 */
export type ReadingOfferState =
  | { state: 'open' }
  | { state: 'busy' }
  | { state: 'kept'; line: AnalyticsLabel }
  | { state: 'dismissed' }
  | { state: 'closed'; message: string }
  | { state: 'failed'; error: unknown }
  | { state: 'full'; message: string }

/** The refusals that end an offer for good: no longer open (437), or the reading no longer allowed (430). */
const OFFER_ENDED = ['COPILOT-437', 'COPILOT-430']
/** The refusals that end a named-set card for good: no longer open (435), or invalid (433). */
const SET_ENDED = ['COPILOT-435', 'COPILOT-433']
/** The reader already keeps 10 sets (3687). */
const SETS_FULL = 'COPILOT-434'

const OPEN: ReadingOfferState = Object.freeze({ state: 'open' }) as ReadingOfferState

/** What `ask` is told besides the question: its origin (871), SQL mode (888) and a stated reading (892). */
export interface AskSaid {
  origin?: CopilotQuestionOrigin
  sqlMode?: boolean
  statedReading?: CopilotStatedReading
}

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
  inFlight: { question: string; requestId: string; confirms?: TurnConfirms; sqlMode?: true } | null
  /** Moves on at every clear, so a reply to a cleared conversation is recognised and dropped. */
  epoch: number
  /**
   * Sends a NEW question, never a reply to a pending ask; `null` (nothing sent) while one is in flight or the
   * conversation cannot take another question. `origin` (871, A49) says where it came from: typed unless said otherwise
   * (a question handed in from another screen is typed, 782), `suggestion` for a tapped suggestion, `starter` for a
   * starter. Only the question box's own text is ever a reply: that is `askFromBox`. `sqlMode` (888, spec 3632 Q27):
   * asked in SQL mode; the panel passes it only while the toggle is on for a holder of the SQL grant. With
   * `statedReading` (892, a tapped assumption line's choice) the question is the tapped answer's, asked again with that
   * reading stated.
   */
  ask: (question: string, said?: AskSaid) => Promise<void> | null
  /**
   * The question box's text (872, A37): while an ask is pending it is the reply to it, sent with the ask's id and the
   * text as the reply (taken even on the tenth question); otherwise a new typed question, as `ask`. `sqlMode` as `ask`.
   */
  askFromBox: (text: string, sqlMode?: boolean) => Promise<void> | null
  /**
   * A tap on one of the pending ask's choices (872, BackOffice 3597): sends the choice's label as shown, with the ask's
   * id, the choice's key and `origin: 'choice'`. `null` (nothing sent) when no ask is pending or one is in flight.
   */
  choose: (choice: { key: string; label: string }) => Promise<void> | null
  /**
   * The SQL mode toggle (888), held here so it outlives the sheet's unmount. Off at start, and off again when the user
   * changes. The panel shows it only on `canSql`.
   */
  sqlMode: boolean
  setSqlMode: (on: boolean) => void
  /**
   * Q46 (BackOffice 3678): the SQL item this conversation was opened on ("Change by asking"), or null. Its id rides as
   * `sqlItemContext` on the first question asked in SQL mode only (`sqlItemSent` then); an answer's Edit opens that
   * item's editor at the revision it was opened at. Dropped by a new conversation, a resumed one and a user change.
   */
  sqlItem: CopilotSqlItemRef | null
  sqlItemSent: boolean
  /** Opens a SQL item: a new conversation (the current one filed), the toggle on, the item held for the first question. */
  openSqlItem: (item: CopilotSqlItemRef) => void
  /**
   * "Try in SQL mode" tapped (888, BackOffice 3674, Q28): the toggle goes on and the offer's question is asked again in
   * SQL mode, in the offer's conversation, or (its id null: that was the conversation's last question) in a new one,
   * the old one filed in the history. `null` as `ask`.
   */
  trySqlOffer: (offer: CopilotSqlOffer) => Promise<void> | null
  /**
   * 885 (BackOffice 3664): Confirm a proposal's card with its values. Not a question: it lands as a turn marked
   * `confirms`, and is sent even at the conversation's tenth question (it takes none). Resolves to the reply (null on a
   * refusal or a dropped reply); `null` (nothing sent) while something is in flight, with no conversation, or once it
   * is over.
   */
  confirm: (card: ProposalCard, values: CardValues) => Promise<CopilotAnswer | null> | null
  /** 885: Cancel a proposal's card, as `confirm`. */
  cancel: (card: ProposalCard) => Promise<CopilotAnswer | null> | null
  /** 892: each offer the reader has acted on, by its id; an offer not here is `open`. In memory, like the thread. */
  offers: Record<string, ReadingOfferState>
  offerState: (offerId: string) => ReadingOfferState
  /** Keep (3686): stores the reading the server offered. `null` while that offer's request runs or after it is done. */
  keepReading: (conversationId: string, offerId: string) => Promise<void> | null
  /** Not now (3686): the line goes; no offer of that kind until the conversation ends. */
  notNowReading: (conversationId: string, offerId: string) => Promise<void> | null
  /** Keep (893, 3687): stores the named set the server proposed. `null` while it runs or once it is kept or closed. */
  keepNamedSet: (conversationId: string, proposalId: string) => Promise<void> | null
  /** Not now (893): calls nothing; the card closes for that answer. */
  notNowNamedSet: (proposalId: string) => void
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
  readings: CopilotReadingDoors = copilotReadingApi,
  namedSets: CopilotNamedSetDoors = copilotNamedSetApi,
) {
  /** The question in flight's abort, so Stop (and a clear) can end its request. */
  let aborter: AbortController | null = null
  const abandon = () => {
    aborter?.abort()
    aborter = null
  }
  const store = create<CopilotConversationState>((set, get) => {
    /**
     * Sends one request and lands its reply (or refusal) as a turn: the reply, or null when refused or dropped. `sqlMode`
     * (888): the question was asked in SQL mode, so the pending turn shows it.
     */
    const run = (body: CopilotAskRequest, question: string, confirms?: TurnConfirms, sqlMode = false): Promise<CopilotAnswer | null> => {
      const { epoch } = get()
      const requestId = newRequestId()
      set({ inFlight: { question, requestId, ...(confirms ? { confirms } : {}), ...(sqlMode ? { sqlMode: true as const } : {}) } })
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
    /**
     * Sends one question, or a reply to the pending ask (`said.askId`): the one path a typed question, a tap and a reply
     * take. In SQL mode the held SQL item (Q46) rides on the first question only.
     */
    const put = (question: string, said: Pick<AskFrom, 'origin' | 'askId' | 'choiceKey' | 'sqlMode' | 'statedReading'>): Promise<void> | null => {
      const { conv, inFlight } = get()
      // A reply to the pending ask is the same question: taken even when the conversation holds its tenth (872).
      if (inFlight !== null || !(said.askId ? boxOpen(conv) : canAskMore(conv)) || question.trim() === '') return null
      const sql = said.sqlMode === true
      const { sqlItem, sqlItemSent } = get()
      const sqlItemContext = sql && sqlItem !== null && !sqlItemSent ? { itemId: sqlItem.itemId } : null
      if (sqlItemContext) set({ sqlItemSent: true })
      const from: AskFrom = { ...said, sqlMode: sql, sqlItemContext, reportContext: reportBridge.getState().context, boardContext: boardBridge.getState().context }
      return run(askBody(conv, question, from), question, undefined, sql).then(() => undefined)
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
      offers: {},
      offerState: (offerId) => get().offers[offerId] ?? OPEN,
      keepReading: (conversationId, offerId) =>
        answerOffer(offerId, () => readings.keep({ conversationId, offerId }), (r) => ({ state: 'kept', line: { en: r?.line?.en ?? '', ar: r?.line?.ar ?? '' } })),
      notNowReading: (conversationId, offerId) => answerOffer(offerId, () => readings.notNow({ conversationId, offerId }), () => ({ state: 'dismissed' })),
      keepNamedSet: (conversationId, proposalId) =>
        answerOffer(
          proposalId,
          () => namedSets.keep({ conversationId, proposalId }),
          (r) => ({ state: 'kept', line: { en: r?.line?.en ?? '', ar: r?.line?.ar ?? '' } }),
          SET_ENDED,
        ),
      notNowNamedSet: (proposalId) => {
        const now = get().offerState(proposalId).state
        if (now === 'open' || now === 'failed' || now === 'full') set((s) => ({ offers: { ...s.offers, [proposalId]: { state: 'dismissed' } } }))
      },
      ask: (question, said = {}) => put(question, { origin: said.origin ?? 'typed', sqlMode: said.sqlMode, statedReading: said.statedReading }),
      askFromBox: (text, sqlMode) => {
        const pending = pendingAsk(get().conv)
        return put(text, pending ? { origin: 'typed', askId: pending.ask.id, sqlMode } : { origin: 'typed', sqlMode })
      },
      choose: (choice) => {
        const pending = pendingAsk(get().conv)
        if (pending === null) return null
        return put(choice.label, { origin: 'choice', askId: pending.ask.id, choiceKey: choice.key })
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
      sqlMode: false,
      setSqlMode: (on) => set({ sqlMode: on }),
      sqlItem: null,
      sqlItemSent: false,
      openSqlItem: (item) => {
        get().startNew()
        set({ sqlMode: true, sqlItem: { itemId: item.itemId, revision: item.revision }, sqlItemSent: false })
      },
      trySqlOffer: (offer) => {
        if (get().inFlight !== null) return null
        if (offer.conversationId === null) get().startNew()
        set({ sqlMode: true })
        return get().ask(offer.question, { sqlMode: true })
      },
      startNew: () => {
        abandon()
        set((s) => ({ conv: EMPTY_CONVERSATION, inFlight: null, epoch: s.epoch + 1, history: filed(s.history, s.conv, now()), sqlItem: null, sqlItemSent: false }))
      },
      resume: (index) =>
        set((s) => {
          const past = s.history[index]
          if (!past) return {}
          abandon()
          const rest = s.history.filter((_, i) => i !== index)
          return { conv: past.conv, inFlight: null, epoch: s.epoch + 1, history: filed(rest, s.conv, now()), sqlItem: null, sqlItemSent: false }
        }),
      forget: (index) => set((s) => ({ history: s.history.filter((_, i) => i !== index) })),
    }
  })
  /** One request per offer, and none once it is kept, dismissed or closed. */
  function answerOffer<T>(offerId: string, call: () => Promise<T>, done: (r: T) => ReadingOfferState, ended: readonly string[] = OFFER_ENDED): Promise<void> | null {
    const now = store.getState().offerState(offerId).state
    if (now !== 'open' && now !== 'failed' && now !== 'full') return null
    const put = (o: ReadingOfferState) => store.setState((s) => ({ offers: { ...s.offers, [offerId]: o } }))
    put({ state: 'busy' })
    return call().then(
      (r) => put(done(r)),
      (error: unknown) =>
        put(
          ended === SET_ENDED && apiErrorCode(error) === SETS_FULL
            ? { state: 'full', message: apiErrorMessage(error, '') }
            : ended.includes(apiErrorCode(error) ?? '')
              ? { state: 'closed', message: apiErrorMessage(error, '') }
              : { state: 'failed', error },
        ),
    )
  }
  useSession.subscribe((user, before) => {
    if (user.userId !== before.userId) abandon()
    if (user.userId !== before.userId) store.setState((s) => ({ conv: EMPTY_CONVERSATION, inFlight: null, epoch: s.epoch + 1, history: [], sqlMode: false, sqlItem: null, sqlItemSent: false, offers: {} }))
  })
  return store
}

export const useCopilotConversation = createCopilotConversation((body, signal) => copilotApi.ask(body, signal))
