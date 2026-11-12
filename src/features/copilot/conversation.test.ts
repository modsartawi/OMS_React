import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { CopilotAnswer } from '@/core/models/copilot'
import { askView, answerLayout, copilotAnswerModel } from './answer'
import { EMPTY_CONVERSATION, askBody, boxOpen, canAskMore, choicesTappable, continuesAsk, isLatestAnswer, questionCount, turnTaps, withAnswer, withRefusal } from './conversation'

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

const refusal = (code: string) =>
  new ApiError('business', `Refused ${code}.`, 403, [{ errorCode: code, internalErrorCode: '', errorMessage: `Refused ${code}.` }])

describe('the conversation (spec 734 D5)', () => {
  it('copilotConversation_keepsIdUntilNewOrFull', () => {
    // The first question goes out bare; the answer's id is kept and sent with every follow-up.
    expect(askBody(EMPTY_CONVERSATION, 'Why was order 7000123456 late?')).toEqual({ question: 'Why was order 7000123456 late?' })
    let c = withAnswer(EMPTY_CONVERSATION, 'Why was order 7000123456 late?', reply('c-0001', 1))
    expect(c.id).toBe('c-0001')
    expect(askBody(c, 'And the one before?')).toEqual({ question: 'And the one before?', conversationId: 'c-0001' })
    c = withAnswer(c, 'And the one before?', reply('c-0001', 2))
    expect(c.id).toBe('c-0001')
    expect(c.turns.map((t) => [t.question, t.questionNo])).toEqual([
      ['Why was order 7000123456 late?', 1],
      ['And the one before?', 2],
    ])
    expect(canAskMore(c)).toBe(true)

    // A refusal that is not 406 joins the thread and keeps the id and the box.
    const refused = withRefusal(c, 'Mobile 0551234567?', refusal('COPILOT-403'))
    expect(refused.id).toBe('c-0001')
    expect(refused.turns).toHaveLength(3)
    expect(refused.turns[2]).toMatchObject({ question: 'Mobile 0551234567?', questionNo: null, reply: null })
    expect(canAskMore(refused)).toBe(true)

    // "New conversation" drops the id and the thread.
    expect(EMPTY_CONVERSATION.id).toBeNull()
    expect(askBody(EMPTY_CONVERSATION, 'Fresh?')).toEqual({ question: 'Fresh?' })
    expect(canAskMore(EMPTY_CONVERSATION)).toBe(true)

    // At question 10 the box is replaced by the offer of a new conversation.
    const ninth = withAnswer(EMPTY_CONVERSATION, 'q9', reply('c-0002', 9))
    expect(canAskMore(ninth)).toBe(true)
    const tenth = withAnswer(ninth, 'q10', reply('c-0002', 10))
    expect(canAskMore(tenth)).toBe(false)

    // …and so is it on COPILOT-406, the conversation expired or full.
    const expired = withRefusal(c, 'Still there?', refusal('COPILOT-406'))
    expect(canAskMore(expired)).toBe(false)
    expect(expired.turns).toHaveLength(3)
  })

  it('copilotConversation_trustsTheServersCount', () => {
    // The server numbers the questions, refusals it counted included: its questionNo is the count.
    let c = withAnswer(EMPTY_CONVERSATION, 'q1', reply('c-0003', 1))
    c = withRefusal(c, 'refused', refusal('COPILOT-403'))
    c = withAnswer(c, 'q', reply('c-0003', 10))
    expect(canAskMore(c)).toBe(false)
  })

  it('copilotConversation_aReplyInAnotherConversationStartsAFreshThread', () => {
    const c = withAnswer(withAnswer(EMPTY_CONVERSATION, 'q1', reply('c-0005', 1)), 'q2', reply('c-0005', 2))
    const moved = withAnswer(c, 'q3', reply('c-0006', 1))
    expect(moved.id).toBe('c-0006')
    expect(moved.over).toBe(false)
    expect(moved.turns.map((t) => [t.question, t.questionNo])).toEqual([['q3', 1]])
    // The first answer of a conversation is not a move.
    expect(withAnswer(EMPTY_CONVERSATION, 'q1', reply('c-0007', 1)).turns).toHaveLength(1)
  })
})

describe('the report in context (spec 819 §D, ticket 832)', () => {
  const context = {
    reportId: 'r-1',
    revision: 2,
    draft: { params: [], bindings: {}, sections: [] },
  }
  it('askBody_sendsTheReportOpenInTheDesigner_andNothingWhenNoneIs', () => {
    expect(askBody(EMPTY_CONVERSATION, 'Add the cancellation rate as a bar', { reportContext: context })).toEqual({ question: 'Add the cancellation rate as a bar', reportContext: context })
    const c = withAnswer(EMPTY_CONVERSATION, 'q1', reply('c-0001', 1))
    expect(askBody(c, 'And a table', { reportContext: context })).toEqual({ question: 'And a table', conversationId: 'c-0001', reportContext: context })
    expect(askBody(c, 'And a table', { reportContext: null })).toEqual({ question: 'And a table', conversationId: 'c-0001' })
  })
})

describe('where the question came from (BackOffice spec 3586 A49, A55, 3598; ticket 871)', () => {
  it('aTappedSuggestion_isAskedWithItsText_andTheOriginSuggestion_aTypedQuestionSaysTyped', () => {
    const c = withAnswer(EMPTY_CONVERSATION, 'How many orders did Olaya deliver last week?', reply('c-0001', 1))
    // The tap: the suggestion's own text, as a normal question in the same conversation.
    expect(askBody(c, 'Break it down by city', { origin: 'suggestion' })).toEqual({
      question: 'Break it down by city',
      conversationId: 'c-0001',
      origin: 'suggestion',
    })
    // A question the reader typed says so.
    expect(askBody(c, 'And Jeddah?', { origin: 'typed' })).toEqual({ question: 'And Jeddah?', conversationId: 'c-0001', origin: 'typed' })
    // The report in context still travels beside the origin.
    const reportContext = { reportId: 'r-1', revision: 2, draft: { params: [], bindings: {}, sections: [] } }
    expect(askBody(EMPTY_CONVERSATION, 'Add a bar', { origin: 'typed', reportContext })).toEqual({
      question: 'Add a bar',
      reportContext,
      origin: 'typed',
    })
  })

  it('onlyTheLatestAnswersSuggestions_canBeTapped', () => {
    let c = withAnswer(EMPTY_CONVERSATION, 'q1', reply('c-0001', 1))
    expect(isLatestAnswer(c, 0)).toBe(true)
    c = withAnswer(c, 'Break it down by city', reply('c-0001', 2))
    // The earlier answer's suggestions are still shown, but no longer tappable.
    expect([isLatestAnswer(c, 0), isLatestAnswer(c, 1)]).toEqual([false, true])
    // A refused question after it is the latest turn: no answer's suggestions are tappable.
    const refused = withRefusal(c, 'Mobile 0551234567?', refusal('COPILOT-403'))
    expect([0, 1, 2].map((i) => isLatestAnswer(refused, i))).toEqual([false, false, false])
    // A conversation that takes no more questions offers none.
    const closed = withRefusal(c, 'Still there?', refusal('COPILOT-406'))
    expect(isLatestAnswer(closed, 1)).toBe(false)
    // The one place the panel asks (3586 review item 8): the earlier answer's are shown only, and none while one is in flight.
    expect([0, 1].map((i) => turnTaps(c, i, false).suggestions)).toEqual([false, true])
    expect(turnTaps(c, 1, true).suggestions).toBe(false)
  })
})

describe('the clarifying question in the thread (BackOffice spec 3586 A36-A40, 3596, 3597; ticket 872)', () => {
  const asked = (questionNo: number, choices: { key: string; en: string; ar: string }[]): CopilotAnswer => ({
    ...reply('c-0001', questionNo),
    answer: 'I could not find "Mall". Type the name again.',
    outcome: 'asked',
    assumptions: [],
    ask: {
      id: 'ask-1',
      question: { en: 'I could not find "Mall". Type the name again.', ar: 'لم أجد «Mall». اكتب الاسم مرة أخرى.' },
      text: 'Mall',
      choices: choices.map((c) => ({ key: c.key, label: { en: c.en, ar: c.ar } })),
    },
  })

  it('anAskWithNoChoices_showsTheQuestion_andLeavesTheBoxOpen_evenOnTheTenthQuestion', () => {
    const c = withAnswer(EMPTY_CONVERSATION, 'How did Mall do?', asked(1, []))
    const model = copilotAnswerModel(c.turns[0].reply)
    expect(answerLayout(model).parts).toEqual(['ask'])
    expect(askView(model, 'en')).toEqual({ question: 'I could not find "Mall". Type the name again.', choices: [] })
    expect(boxOpen(c)).toBe(true)
    // Asked on the conversation's tenth question, the box still takes the reply: it is the same question.
    let full = EMPTY_CONVERSATION
    for (let n = 1; n <= 9; n++) full = withAnswer(full, `q${n}`, reply('c-0001', n))
    full = withAnswer(full, 'How did Mall do?', asked(10, []))
    expect(canAskMore(full)).toBe(false)
    expect(boxOpen(full)).toBe(true)
    // A plain tenth answer closes it, as before.
    expect(boxOpen(withAnswer(full, 'the airport one', reply('c-0001', 10)))).toBe(false)
  })

  it('theAskedHalfAndItsContinuation_countAsOneQuestion', () => {
    let c = withAnswer(EMPTY_CONVERSATION, 'Orders last week?', reply('c-0001', 1))
    c = withAnswer(c, 'How did Mall do?', asked(2, [{ key: 'store:S102', en: 'Jeddah Mall (store, Jeddah)', ar: 'جدة مول' }]))
    expect(questionCount(c)).toBe(2)
    c = withAnswer(c, 'Jeddah Mall (store, Jeddah)', reply('c-0001', 2))
    // The continuation keeps the asked half's number: no new question, and its turn draws no new number.
    expect(questionCount(c)).toBe(2)
    expect([0, 1, 2].map((i) => continuesAsk(c, i))).toEqual([false, false, true])
    c = withAnswer(c, 'And Riyadh?', reply('c-0001', 3))
    expect(questionCount(c)).toBe(3)
    expect(continuesAsk(c, 3)).toBe(false)
    // A reply the server took as a new question (its ask had gone) has the next number: it counts.
    let gone = withAnswer(EMPTY_CONVERSATION, 'How did Mall do?', asked(1, []))
    gone = withAnswer(gone, 'Mall of Arabia', reply('c-0001', 2))
    expect(questionCount(gone)).toBe(2)
  })

  it('afterTheContinuationsAnswer_theChoicesCannotBeTapped_butARefusedReplyLeavesThemOpen', () => {
    const choices = [{ key: 'store:S102', en: 'Jeddah Mall (store, Jeddah)', ar: 'جدة مول' }]
    const c = withAnswer(EMPTY_CONVERSATION, 'How did Mall do?', asked(1, choices))
    expect(choicesTappable(c, 0)).toBe(true)
    // A refused reply changes nothing on the server: the ask is still pending and its choices still tap.
    const refused = withRefusal(c, 'Mall 0551234567', refusal('COPILOT-403'))
    expect(choicesTappable(refused, 0)).toBe(true)
    // The continuation's answer ends it.
    const answered = withAnswer(refused, 'Jeddah Mall (store, Jeddah)', reply('c-0001', 1))
    expect([0, 1, 2].map((i) => choicesTappable(answered, i))).toEqual([false, false, false])
    // So does a conversation closed under it.
    expect(choicesTappable(withRefusal(c, 'Still there?', refusal('COPILOT-406')), 0)).toBe(false)
    // The one place the panel asks (3586 review item 8): locked once answered, and while a reply is in flight.
    expect(turnTaps(refused, 0, false).choices).toBe(true)
    expect(turnTaps(refused, 0, true).choices).toBe(false)
    expect([0, 1, 2].map((i) => turnTaps(answered, i, false).choices)).toEqual([false, false, false])
  })
})

