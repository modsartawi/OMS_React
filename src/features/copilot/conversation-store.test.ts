import { afterEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { useSession } from '@/core/session'
import type { CopilotAnswer, CopilotAskRequest } from '@/core/models/copilot'
import { createBoardContext } from '@/core/board-context'
import { createReportContext } from '@/core/report-context'
import { COPILOT_HISTORY_MAX, createCopilotConversation, filed, type PastConversation } from './conversation-store'

const reply = (conversationId: string, questionNo: number): CopilotAnswer => ({
  conversationId,
  questionNo,
  answer: `Answer ${questionNo}.`,
  orderRefs: [],
  trace: [],
  outcome: 'answered',
  stoppedEarly: false,
  servedBy: 'anthropic/claude-opus-5-5',
  askedAt: '2026-11-03T10:15:00',
})

/** A `Copilot/Ask` stand-in whose calls the test answers by hand, in any order. */
function door() {
  const calls: {
    body: CopilotAskRequest
    requestId?: string
    signal?: AbortSignal
    answer: (r: CopilotAnswer) => void
    refuse: (e: unknown) => void
  }[] = []
  // The live steps' id (869) is kept beside the body, so each test's body reads as the question it sent.
  const ask = ({ requestId, ...body }: CopilotAskRequest, signal?: AbortSignal) =>
    new Promise<CopilotAnswer>((answer, refuse) => {
      calls.push({ body, requestId, signal, answer, refuse })
    })
  return { ask, calls }
}

afterEach(() => useSession.getState().clear())

describe('the copilot conversation store (spec 734 D5, review items 1 and 2)', () => {
  it('copilotStore_oneAskInFlight_replyLandsInTheThread', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const done = store.getState().ask('Why was order 7000123456 late?')
    expect(done).not.toBeNull()
    expect(store.getState().inFlight?.question).toBe('Why was order 7000123456 late?')
    // A second ask while one is in flight is refused: one ask at a time, whichever panel sent it.
    expect(store.getState().ask('And another?')).toBeNull()
    expect(d.calls).toHaveLength(1)
    d.calls[0].answer(reply('c-0001', 1))
    await done
    expect(store.getState().inFlight).toBeNull()
    expect(store.getState().conv.id).toBe('c-0001')
    expect(store.getState().conv.turns.map((t) => t.question)).toEqual(['Why was order 7000123456 late?'])
    // The follow-up sends the id back.
    const next = store.getState().ask('And the one before?')
    expect(d.calls[1].body).toEqual({ question: 'And the one before?', conversationId: 'c-0001' })
    d.calls[1].refuse(new ApiError('business', 'No.', 400, [{ errorCode: 'COPILOT-403', internalErrorCode: '', errorMessage: 'No.' }]))
    await next
    expect(store.getState().inFlight).toBeNull()
    expect(store.getState().conv.turns).toHaveLength(2)
    expect(store.getState().conv.turns[1].reply).toBeNull()
  })

  it('copilotStore_aLateReplyToAClearedConversationIsDropped', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const late = store.getState().ask('slow question')
    store.getState().startNew()
    expect(store.getState().inFlight).toBeNull()
    // The new conversation can ask at once; the old reply, arriving after, is dropped.
    const fresh = store.getState().ask('fresh question')
    expect(d.calls[1].body).toEqual({ question: 'fresh question' })
    d.calls[0].answer(reply('c-old', 1))
    await late
    expect(store.getState().conv.turns).toHaveLength(0)
    expect(store.getState().inFlight?.question).toBe('fresh question')
    d.calls[1].answer(reply('c-new', 1))
    await fresh
    expect(store.getState().conv.id).toBe('c-new')
    expect(store.getState().conv.turns.map((t) => t.question)).toEqual(['fresh question'])
  })

  it('copilotStore_stopAbortsTheQuestionInFlightAndHandsItBack', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    expect(store.getState().stop()).toBeNull()
    const first = store.getState().ask('add a pie chart')
    expect(d.calls[0].signal?.aborted).toBe(false)
    expect(store.getState().stop()).toBe('add a pie chart')
    // The request is aborted (so the server stops), nothing is in flight, and the next question can go at once.
    expect(d.calls[0].signal?.aborted).toBe(true)
    expect(store.getState().inFlight).toBeNull()
    const second = store.getState().ask('add a donut chart')
    expect(second).not.toBeNull()
    // The stopped question's late reply (or its abort failure) adds nothing to the thread.
    d.calls[0].refuse(new ApiError('network', 'aborted', 0))
    await first
    expect(store.getState().conv.turns).toHaveLength(0)
    expect(store.getState().inFlight?.question).toBe('add a donut chart')
    d.calls[1].answer(reply('c-1', 1))
    await second
    expect(store.getState().conv.turns.map((t) => t.question)).toEqual(['add a donut chart'])
    expect(d.calls[1].signal?.aborted).toBe(false)
  })

  it('copilotStore_aNewConversationAbortsTheQuestionInFlight', () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    store.getState().ask('slow question')
    store.getState().startNew()
    expect(d.calls[0].signal?.aborted).toBe(true)
  })

  it('copilotStore_clearsWhenTheUserChangesOrSignsOut', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    useSession.getState().setSession({ userId: 'a.user' })
    const first = store.getState().ask('a question of A')
    d.calls[0].answer(reply('c-a', 1))
    await first
    expect(store.getState().conv.turns).toHaveLength(1)

    // Sign-out empties it.
    useSession.getState().clear()
    expect(store.getState().conv.turns).toHaveLength(0)
    expect(store.getState().conv.id).toBeNull()

    // A's question still in flight when B signs in: B never sees its reply.
    useSession.getState().setSession({ userId: 'a.user' })
    const inFlight = store.getState().ask('another of A')
    useSession.getState().setSession({ userId: 'b.user' })
    expect(store.getState().inFlight).toBeNull()
    d.calls[1].answer(reply('c-a', 2))
    await inFlight
    expect(store.getState().conv.turns).toHaveLength(0)

    // A store switch for the same user is no change of user: the thread stays.
    const own = store.getState().ask('a question of B')
    d.calls[2].answer(reply('c-b', 1))
    await own
    useSession.getState().setCurrentStore('P002')
    expect(store.getState().conv.turns).toHaveLength(1)
  })
})

describe('the copilot history (CTO demo)', () => {
  const answered = async (store: ReturnType<typeof createCopilotConversation>, d: ReturnType<typeof door>, q: string, id: string) => {
    const done = store.getState().ask(q)
    d.calls[d.calls.length - 1].answer(reply(id, 1))
    await done
  }

  it('copilotHistory_newConversationFilesTheOldOne_mostRecentFirst_emptyOnesNotKept', async () => {
    const d = door()
    let clock = 1000
    const store = createCopilotConversation(d.ask, () => clock)
    store.getState().startNew()
    expect(store.getState().history).toHaveLength(0)
    await answered(store, d, 'first', 'c-1')
    store.getState().startNew()
    clock = 2000
    await answered(store, d, 'second', 'c-2')
    store.getState().startNew()
    expect(store.getState().history.map((p) => [p.conv.id, p.at])).toEqual([
      ['c-2', 2000],
      ['c-1', 1000],
    ])
  })

  it('copilotHistory_resumeSwapsTheCurrentConversationIntoTheHistory_andKeepsItsId', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask, () => 5)
    await answered(store, d, 'old', 'c-old')
    store.getState().startNew()
    await answered(store, d, 'now', 'c-now')
    store.getState().resume(0)
    expect(store.getState().conv.id).toBe('c-old')
    expect(store.getState().history.map((p) => p.conv.id)).toEqual(['c-now'])
    // A follow-up in the resumed conversation sends its id back.
    store.getState().ask('more')
    expect(d.calls[d.calls.length - 1].body).toEqual({ question: 'more', conversationId: 'c-old' })
  })

  it('copilotHistory_forgetDropsOne_andAChangeOfUserEmptiesIt', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    useSession.getState().setSession({ userId: 'a.user' })
    await answered(store, d, 'one', 'c-1')
    store.getState().startNew()
    await answered(store, d, 'two', 'c-2')
    store.getState().startNew()
    store.getState().forget(1)
    expect(store.getState().history.map((p) => p.conv.id)).toEqual(['c-2'])
    useSession.getState().clear()
    expect(store.getState().history).toHaveLength(0)
  })

  it('copilotHistory_keepsAtMostTheCap', () => {
    const conv = { id: 'c', turns: [{ question: 'q', questionNo: 1, reply: null, refusal: null }], over: false }
    let h: PastConversation[] = []
    for (let i = 0; i < COPILOT_HISTORY_MAX + 5; i++) h = filed(h, conv, i)
    expect(h).toHaveLength(COPILOT_HISTORY_MAX)
    expect(h[0].at).toBe(COPILOT_HISTORY_MAX + 4)
  })
})

describe('the copilot and the report open in the designer (spec 819 §D, ticket 832)', () => {
  const definition = (heading: string) => ({ params: [], bindings: {}, sections: [{ id: 's1', heading: { en: heading, ar: '' }, blocks: [] }] })
  const context = { reportId: 'r-1', revision: 1, draft: definition('Sales') }
  const edited = (reportId: string): CopilotAnswer => ({
    ...reply('c-0001', 1),
    reportEdit: { reportId, definition: definition('Sales and cancellations'), note: { en: 'Added a bar.', ar: '' } },
  })

  it('ask_sendsThePublishedReportAsReportContext', async () => {
    const d = door()
    const bridge = createReportContext()
    const store = createCopilotConversation(d.ask, () => 0, bridge)
    bridge.getState().publish(context)
    const done = store.getState().ask('Add the cancellation rate as a bar')
    expect(d.calls[0].body).toEqual({ question: 'Add the cancellation rate as a bar', reportContext: context })
    d.calls[0].answer(reply('c-0001', 1))
    await done
    bridge.getState().clear('r-1')
    void store.getState().ask('Anything else?')
    expect(d.calls[1].body).toEqual({ question: 'Anything else?', conversationId: 'c-0001' })
  })

  it('aLandedReportEdit_isPostedToTheDesigner_labelledWithTheQuestion', async () => {
    const d = door()
    const bridge = createReportContext()
    const store = createCopilotConversation(d.ask, () => 0, bridge)
    bridge.getState().publish(context)
    const done = store.getState().ask('add the cancellation rate as a bar')
    d.calls[0].answer(edited('r-1'))
    await done
    const taken = bridge.getState().takeEdit('r-1')
    expect(taken?.request).toBe('add the cancellation rate as a bar')
    expect(taken?.edit.definition.sections[0].heading.en).toBe('Sales and cancellations')
  })

  it('anEditForAClearedConversation_isNeverPosted', async () => {
    const d = door()
    const bridge = createReportContext()
    const store = createCopilotConversation(d.ask, () => 0, bridge)
    bridge.getState().publish(context)
    const done = store.getState().ask('add a bar')
    store.getState().startNew()
    d.calls[0].answer(edited('r-1'))
    await done
    expect(bridge.getState().takeEdit('r-1')).toBeNull()
  })
})


describe('the copilot and the board open in its editor (ticket 836, BackOffice 3430)', () => {
  const definition = (viewId: string) => ({ params: [], bindings: {}, panels: [{ id: 'p-a', kind: 'view' as const, viewId, layout: { x: 0, y: 0, w: 6, h: 3 }, optOut: [] }] })
  const context = { boardId: 'b-1', revision: 2, draft: definition('v-1') }

  it('ask_sendsThePublishedBoardAsBoardContext_andTheReportBesideIt', async () => {
    const d = door()
    const reports = createReportContext()
    const boards = createBoardContext()
    const store = createCopilotConversation(d.ask, () => 0, reports, boards)
    boards.getState().publish(context, { en: 'Delivery', ar: 'التوصيل' })
    const done = store.getState().ask('Remove the stores chart')
    expect(d.calls[0].body).toEqual({ question: 'Remove the stores chart', boardContext: context })
    d.calls[0].answer(reply('c-0001', 1))
    await done
    boards.getState().clear('b-1')
    void store.getState().ask('Anything else?')
    expect(d.calls[1].body).toEqual({ question: 'Anything else?', conversationId: 'c-0001' })
  })

  it('aLandedBoardEdit_isPostedToTheEditor_labelledWithTheQuestion', async () => {
    const d = door()
    const boards = createBoardContext()
    const store = createCopilotConversation(d.ask, () => 0, createReportContext(), boards)
    boards.getState().publish(context)
    const done = store.getState().ask('swap the chart')
    d.calls[0].answer({ ...reply('c-0001', 1), boardEdit: { boardId: 'b-1', definition: definition('v-2'), note: { en: 'Swapped it.', ar: '' } } })
    await done
    const taken = boards.getState().takeEdit('b-1')
    expect(taken?.request).toBe('swap the chart')
    expect(taken?.edit.definition.panels[0]).toMatchObject({ viewId: 'v-2' })
    expect(boards.getState().takeEdit('b-1')).toBeNull()
  })
})

describe('the live steps id (ticket 869, BackOffice spec 3558 D17)', () => {
  const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/

  it('ask_sendsAFreshUlidRequestId_heldInFlightOnlyWhileTheQuestionIsOut', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    expect(store.getState().inFlight).toBeNull()

    const first = store.getState().ask('How many orders yesterday?')
    const id1 = d.calls[0].requestId
    expect(id1).toMatch(ULID)
    expect(store.getState().inFlight?.requestId).toBe(id1)
    d.calls[0].answer(reply('c-0001', 1))
    await first
    // The answer landed: the panel stops polling.
    expect(store.getState().inFlight).toBeNull()

    // One question, one id: the next question mints its own.
    const second = store.getState().ask('And the day before?')
    const id2 = d.calls[1].requestId
    expect(id2).toMatch(ULID)
    expect(id2).not.toBe(id1)
    expect(store.getState().inFlight?.requestId).toBe(id2)
    d.calls[1].refuse(new ApiError('business', 'No.', 400, [{ errorCode: 'COPILOT-403', internalErrorCode: '', errorMessage: 'No.' }]))
    await second
    expect(store.getState().inFlight).toBeNull()

    void store.getState().ask('A slow one')
    expect(store.getState().inFlight?.requestId).toBe(d.calls[2].requestId)
    store.getState().stop()
    expect(store.getState().inFlight).toBeNull()

    void store.getState().ask('Another slow one')
    expect(store.getState().inFlight?.requestId).toBe(d.calls[3].requestId)
    store.getState().startNew()
    expect(store.getState().inFlight).toBeNull()
  })
})

describe('a tapped reading and the offer to keep one (BackOffice spec 3633 R15-R17, 3685, 3686; ticket 892)', () => {
  const refusal = (code: string) => new ApiError('business', `${code} said no.`, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: `${code} said no.` }])
  const OFFER = '0123456789abcdef0123456789abcdef'
  const kept = {
    kind: 'period' as const,
    value: 'last-7-days',
    keptAt: '2026-11-12T10:00:00',
    line: { en: 'Kept: I will read the period as the last 7 days when you do not say.', ar: 'تم الحفظ: سأقرأ الفترة على أنها آخر 7 أيام ما لم تحدّد.' },
  }
  /** The two offer doors, answered by hand. */
  function offerDoors() {
    const calls: { door: 'keep' | 'notNow'; body: unknown; answer: (r: unknown) => void; refuse: (e: unknown) => void }[] = []
    const call = (door: 'keep' | 'notNow') => (body: unknown) =>
      new Promise<never>((answer, refuse) => {
        calls.push({ door, body, answer: answer as (r: unknown) => void, refuse })
      })
    return { doors: { keep: call('keep'), notNow: call('notNow') } as never, calls }
  }

  it('aChoiceSendsTheSameQuestionAgain_withTheReadingStated_inTheSameConversation', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const first = store.getState().ask('How did sales do?')
    d.calls[0].answer(reply('c-0001', 1))
    await first
    const again = store.getState().ask('How did sales do?', undefined, { kind: 'period', value: 'last-7-days' })
    expect(again).not.toBeNull()
    expect(d.calls[1].body).toEqual({ question: 'How did sales do?', conversationId: 'c-0001', statedReading: { kind: 'period', value: 'last-7-days' } })
    d.calls[1].answer(reply('c-0001', 2))
    await again
    expect(store.getState().conv.turns.map((t) => t.question)).toEqual(['How did sales do?', 'How did sales do?'])
    // A typed question states nothing.
    void store.getState().ask('And Jeddah?')
    expect(d.calls[2].body).toEqual({ question: 'And Jeddah?', conversationId: 'c-0001' })
  })

  it('keep_sendsTheOfferId_andTheLineConfirmsInTheServersWords', async () => {
    const o = offerDoors()
    const store = createCopilotConversation(door().ask, undefined, undefined, undefined, o.doors)
    expect(store.getState().offerState(OFFER)).toEqual({ state: 'open' })
    const keeping = store.getState().keepReading('c-0001', OFFER)
    expect(o.calls).toEqual([expect.objectContaining({ door: 'keep', body: { conversationId: 'c-0001', offerId: OFFER } })])
    expect(store.getState().offerState(OFFER)).toEqual({ state: 'busy' })
    // One request at a time: a second tap while it runs sends nothing.
    void store.getState().keepReading('c-0001', OFFER)
    void store.getState().notNowReading('c-0001', OFFER)
    expect(o.calls).toHaveLength(1)
    o.calls[0].answer(kept)
    await keeping
    expect(store.getState().offerState(OFFER)).toEqual({ state: 'kept', line: kept.line })
  })

  it('notNow_sendsTheOfferId_andHidesTheLine', async () => {
    const o = offerDoors()
    const store = createCopilotConversation(door().ask, undefined, undefined, undefined, o.doors)
    const later = store.getState().notNowReading('c-0001', OFFER)
    expect(o.calls).toEqual([expect.objectContaining({ door: 'notNow', body: { conversationId: 'c-0001', offerId: OFFER } })])
    o.calls[0].answer({ kind: 'period' })
    await later
    expect(store.getState().offerState(OFFER)).toEqual({ state: 'dismissed' })
  })

  it('anOfferNoLongerOpen_losesItsButtons_aFailureKeepsThemToTryAgain', async () => {
    const o = offerDoors()
    const store = createCopilotConversation(door().ask, undefined, undefined, undefined, o.doors)
    const gone = store.getState().keepReading('c-1', 'a')
    o.calls[0].refuse(refusal('COPILOT-437'))
    await gone
    expect(store.getState().offerState('a')).toEqual({ state: 'closed', message: 'COPILOT-437 said no.' })
    const notAllowed = store.getState().keepReading('c-1', 'b')
    o.calls[1].refuse(refusal('COPILOT-430'))
    await notAllowed
    expect(store.getState().offerState('b')).toEqual({ state: 'closed', message: 'COPILOT-430 said no.' })
    const down = store.getState().keepReading('c-1', 'c')
    const err = new Error('network')
    o.calls[2].refuse(err)
    await down
    expect(store.getState().offerState('c')).toEqual({ state: 'failed', error: err })
    // Failed is still open to another tap.
    void store.getState().keepReading('c-1', 'c')
    expect(o.calls).toHaveLength(4)
  })
})

describe("the named-set card's Keep and Not now (BackOffice spec 3633 R20, 3687; ticket 893)", () => {
  const refusal = (code: string, message: string) => new ApiError('business', message, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])
  const SET = 'fedcba9876543210fedcba9876543210'
  const kept = {
    setId: '01JC0000000000000000000000',
    name: 'my stores',
    kind: 'city',
    members: [{ key: 'city:Jeddah', kind: 'city', label: { en: 'Jeddah (city)', ar: 'جدة (مدينة)' } }],
    keptAt: '2026-11-12T10:00:00',
    line: { en: 'Kept "my stores".', ar: 'تم حفظ "my stores".' },
  }
  function keepDoor() {
    const calls: { body: unknown; answer: (r: unknown) => void; refuse: (e: unknown) => void }[] = []
    const keep = (body: unknown) =>
      new Promise<never>((answer, refuse) => {
        calls.push({ body, answer: answer as (r: unknown) => void, refuse })
      })
    return { doors: { keep } as never, calls }
  }
  const storeWith = (doors: never) => createCopilotConversation(door().ask, undefined, undefined, undefined, undefined, doors)

  it('keep_sendsTheConversationAndTheProposal_andTheCardShowsTheServersLine', async () => {
    const k = keepDoor()
    const store = storeWith(k.doors)
    expect(store.getState().offerState(SET)).toEqual({ state: 'open' })
    const keeping = store.getState().keepNamedSet('c-0001', SET)
    expect(k.calls.map((c) => c.body)).toEqual([{ conversationId: 'c-0001', proposalId: SET }])
    expect(store.getState().offerState(SET)).toEqual({ state: 'busy' })
    expect(store.getState().keepNamedSet('c-0001', SET)).toBeNull()
    k.calls[0].answer(kept)
    await keeping
    expect(store.getState().offerState(SET)).toEqual({ state: 'kept', line: kept.line })
    expect(store.getState().keepNamedSet('c-0001', SET)).toBeNull()
  })

  it('aRefusalAtTheLimit_isShownWithItsMessage_andKeepCanBeTriedAgainAfterADelete', async () => {
    const k = keepDoor()
    const store = storeWith(k.doors)
    const full = store.getState().keepNamedSet('c-0001', SET)
    const said = 'You already keep 10 sets. Delete one on "What the copilot knows about me" first.'
    k.calls[0].refuse(refusal('COPILOT-434', said))
    await full
    expect(store.getState().offerState(SET)).toEqual({ state: 'full', message: said })
    void store.getState().keepNamedSet('c-0001', SET)
    expect(k.calls).toHaveLength(2)
  })

  it('aCardNoLongerOpen_losesItsButtons_andNotNowCallsNothing', async () => {
    const k = keepDoor()
    const store = storeWith(k.doors)
    const gone = store.getState().keepNamedSet('c-0001', SET)
    k.calls[0].refuse(refusal('COPILOT-435', 'This set can no longer be kept.'))
    await gone
    expect(store.getState().offerState(SET)).toEqual({ state: 'closed', message: 'This set can no longer be kept.' })
    store.getState().notNowNamedSet('other')
    expect(store.getState().offerState('other')).toEqual({ state: 'dismissed' })
    expect(k.calls).toHaveLength(1)
  })
})
