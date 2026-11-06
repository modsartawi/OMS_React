import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { CopilotAnswer } from '@/core/models/copilot'
import { EMPTY_CONVERSATION, askBody, canAskMore, withAnswer, withRefusal } from './conversation'

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
    draft: { title: { en: 'Channel sales', ar: '' }, subtitle: { en: '', ar: '' }, definition: { params: [], bindings: {}, sections: [] } },
  }
  it('askBody_sendsTheReportOpenInTheDesigner_andNothingWhenNoneIs', () => {
    expect(askBody(EMPTY_CONVERSATION, 'Add the cancellation rate as a bar', context)).toEqual({ question: 'Add the cancellation rate as a bar', reportContext: context })
    const c = withAnswer(EMPTY_CONVERSATION, 'q1', reply('c-0001', 1))
    expect(askBody(c, 'And a table', context)).toEqual({ question: 'And a table', conversationId: 'c-0001', reportContext: context })
    expect(askBody(c, 'And a table', null)).toEqual({ question: 'And a table', conversationId: 'c-0001' })
  })
})

