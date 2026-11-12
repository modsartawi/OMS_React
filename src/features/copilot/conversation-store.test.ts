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
    origin?: CopilotAskRequest['origin']
    signal?: AbortSignal
    answer: (r: CopilotAnswer) => void
    refuse: (e: unknown) => void
  }[] = []
  // The live steps' id (869) and the origin (871) are kept beside the body, so each test's body reads as the question it sent.
  const ask = ({ requestId, origin, ...body }: CopilotAskRequest, signal?: AbortSignal) =>
    new Promise<CopilotAnswer>((answer, refuse) => {
      calls.push({ body, requestId, origin, signal, answer, refuse })
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

describe('where the question came from (BackOffice 3598, A49; ticket 871)', () => {
  it('aTypedQuestionSaysTyped_aTappedSuggestionSaysSuggestion_inTheSameConversation', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const typed = store.getState().ask('How many orders did Olaya deliver last week?')
    expect(d.calls[0].origin).toBe('typed')
    d.calls[0].answer(reply('c-0001', 1))
    await typed
    const tapped = store.getState().ask('Break it down by city', 'suggestion')
    expect(d.calls[1].body).toEqual({ question: 'Break it down by city', conversationId: 'c-0001' })
    expect(d.calls[1].origin).toBe('suggestion')
    d.calls[1].answer(reply('c-0001', 2))
    await tapped
    expect(store.getState().conv.turns.map((t) => t.question)).toEqual(['How many orders did Olaya deliver last week?', 'Break it down by city'])
  })
})

describe('the reply to a clarifying question (BackOffice spec 3586 A37, A55, 3597; ticket 872)', () => {
  const asked = (conversationId: string, questionNo: number, choices: { key: string; en: string; ar: string }[]): CopilotAnswer => ({
    ...reply(conversationId, questionNo),
    answer: 'Which one did you mean by "Mall"?',
    outcome: 'asked',
    assumptions: [],
    ask: {
      id: 'ask-1',
      question: { en: 'Which one did you mean by "Mall"?', ar: 'أيّها تقصد بـ «Mall»؟' },
      text: 'Mall',
      choices: choices.map((c) => ({ key: c.key, label: { en: c.en, ar: c.ar } })),
    },
  })

  it('aTapOnAChoice_sendsTheAsksId_theChosenKey_itsLabelAsShown_andTheOriginChoice', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const first = store.getState().ask('How did Mall do last week?')
    d.calls[0].answer(asked('c-0001', 1, [{ key: 'store:S102', en: 'Jeddah Mall (store, Jeddah)', ar: 'جدة مول (فرع، جدة)' }]))
    await first
    const tapped = store.getState().choose({ key: 'store:S102', label: 'Jeddah Mall (store, Jeddah)' })
    expect(tapped).not.toBeNull()
    expect(d.calls[1].body).toEqual({ question: 'Jeddah Mall (store, Jeddah)', conversationId: 'c-0001', askId: 'ask-1', choiceKey: 'store:S102' })
    expect(d.calls[1].origin).toBe('choice')
    d.calls[1].answer(reply('c-0001', 1))
    await tapped
    expect(store.getState().conv.turns.map((t) => [t.question, t.questionNo])).toEqual([
      ['How did Mall do last week?', 1],
      ['Jeddah Mall (store, Jeddah)', 1],
    ])
  })

  it('textTypedWhileTheAskIsPending_isSentAsTheReply_withTheAsksIdAndTheText_andNoKey', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const first = store.getState().ask('How did Mall do last week?')
    d.calls[0].answer(asked('c-0001', 1, [{ key: 'store:S102', en: 'Jeddah Mall (store, Jeddah)', ar: 'جدة مول (فرع، جدة)' }]))
    await first
    const typed = store.getState().ask('the one near the airport')
    expect(d.calls[1].body).toEqual({ question: 'the one near the airport', conversationId: 'c-0001', askId: 'ask-1' })
    expect(d.calls[1].origin).toBe('typed')
    d.calls[1].answer(reply('c-0001', 1))
    await typed
    // Once answered, the ask is over: the next typed question is a new one.
    void store.getState().ask('And Riyadh?')
    expect(d.calls[2].body).toEqual({ question: 'And Riyadh?', conversationId: 'c-0001' })
  })

  it('anAskOnTheTenthQuestion_stillTakesTheTypedReply_thenTheConversationIsFull', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    for (let n = 1; n <= 9; n++) {
      const p = store.getState().ask(`q${n}`)
      d.calls[n - 1].answer(reply('c-0001', n))
      await p
    }
    const tenth = store.getState().ask('How did Mall do?')
    d.calls[9].answer(asked('c-0001', 10, []))
    await tenth
    const typed = store.getState().ask('Mall of Arabia')
    expect(typed).not.toBeNull()
    expect(d.calls[10].body).toEqual({ question: 'Mall of Arabia', conversationId: 'c-0001', askId: 'ask-1' })
    d.calls[10].answer(reply('c-0001', 10))
    await typed
    expect(store.getState().ask('One more?')).toBeNull()
  })
})
