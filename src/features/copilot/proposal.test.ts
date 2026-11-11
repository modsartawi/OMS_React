import { afterEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { useSession } from '@/core/session'
import type { CopilotAnswer, CopilotAskRequest, CopilotProposal } from '@/core/models/copilot'
import { createCopilotConversation } from './conversation-store'
import { MY_SCHEDULES_PATH } from '@/core/analytics-routes'
import { cardLive, cardReady, cardState, confirmationBody, confirmedNote, proposalCard, withCadence, withDay } from './proposal'

/** A proposal as BackOffice 3663 writes it: "send me this every Monday" after a sales question. */
const PROPOSAL: CopilotProposal = {
  id: 'p-01',
  kind: 'schedule',
  lines: [
    { en: 'What: Sales by city last week', ar: 'ماذا: المبيعات حسب المدينة الأسبوع الماضي' },
    { en: '- Sales by city', ar: '- المبيعات حسب المدينة' },
    { en: 'When: every Monday at 07:00 Riyadh time', ar: 'متى: كل يوم الاثنين الساعة 07:00 بتوقيت الرياض' },
    { en: 'Figures: the 7 days before each send', ar: 'الأرقام: الأيام السبعة قبل كل إرسال' },
    { en: 'To: you only, at reader@example.com', ar: 'إلى: أنت فقط، على reader@example.com' },
  ],
  values: {
    title: 'Sales by city last week',
    cadence: { kind: 'weekly', days: ['mon'], day: null },
    time: '07:00',
    lang: 'en',
    periodChoice: 'sameLength',
    periodChoices: [
      { key: 'sameLength', label: { en: 'The same number of days', ar: 'نفس عدد الأيام' } },
      { key: 'sameDates', label: { en: 'The same dates', ar: 'نفس التواريخ' } },
    ],
  },
}

const proposed = (over: Partial<CopilotAnswer> = {}): Partial<CopilotAnswer> => ({
  conversationId: 'c-1',
  questionNo: 2,
  outcome: 'proposed',
  answer: 'I can send you this. Confirm below.',
  proposal: PROPOSAL,
  ...over,
})

describe('a proposed answer is drawn as a card (885, BackOffice 3663)', () => {
  it('proposedAnswer_drawsTheCardWithItsLinesAndItsDefaults', () => {
    const card = proposalCard(proposed(), 'en')
    expect(card).not.toBeNull()
    expect(card!.id).toBe('p-01')
    expect(card!.dir).toBe('ltr')
    expect(card!.lines).toEqual([
      'What: Sales by city last week',
      '- Sales by city',
      'When: every Monday at 07:00 Riyadh time',
      'Figures: the 7 days before each send',
      'To: you only, at reader@example.com',
    ])
    expect(card!.values).toEqual({
      title: 'Sales by city last week',
      cadence: { kind: 'weekly', days: ['mon'], day: null },
      time: '07:00',
      periodChoice: 'sameLength',
    })
    expect(card!.periodChoices).toEqual([
      { key: 'sameLength', label: 'The same number of days' },
      { key: 'sameDates', label: 'The same dates' },
    ])
  })
})

/** A `Copilot/Ask` stand-in the test answers by hand. */
function door() {
  const calls: { body: CopilotAskRequest; answer: (r: Partial<CopilotAnswer>) => void; refuse: (e: unknown) => void }[] = []
  const ask = ({ requestId: _id, ...body }: CopilotAskRequest) =>
    new Promise<CopilotAnswer>((answer, refuse) => {
      calls.push({ body, refuse, answer: (r) => answer({ orderRefs: [], trace: [], stoppedEarly: false, servedBy: '', askedAt: '', ...r } as CopilotAnswer) })
    })
  return { ask, calls }
}

/** A conversation whose one turn is the proposed answer. */
async function withProposal() {
  const d = door()
  const store = createCopilotConversation(d.ask)
  const asked = store.getState().ask('send me this every Monday')
  d.calls[0].answer(proposed())
  await asked
  return { d, store, card: proposalCard(store.getState().conv.turns[0].reply, 'en')! }
}

afterEach(() => useSession.getState().clear())

describe('Confirm and Cancel (885, BackOffice 3664)', () => {
  it('confirm_sendsTheProposalIdWithTheCardsChangedValues', async () => {
    const { d, store, card } = await withProposal()
    const edited = {
      title: 'Weekly sales',
      cadence: { kind: 'weekly' as const, days: ['sun' as const, 'wed' as const], day: null },
      time: '08:30',
      periodChoice: 'sameDates' as const,
    }
    expect(store.getState().confirm(card, edited)).not.toBeNull()
    expect(d.calls[1].body).toEqual({
      question: '',
      conversationId: 'c-1',
      confirmation: {
        proposalId: 'p-01',
        values: {
          title: 'Weekly sales',
          cadence: { kind: 'weekly', days: ['sun', 'wed'], day: null },
          time: '08:30',
          periodChoice: 'sameDates',
          lang: 'en',
        },
      },
    })
  })
})

describe('the card after Confirm or Cancel (885, BackOffice 3664)', () => {
  it('cancel_sendsACancel_andTheCardCloses', async () => {
    const { d, store, card } = await withProposal()
    expect(cardState(store.getState().conv, 0)).toBe('open')
    const cancelled = store.getState().cancel(card)
    expect(d.calls[1].body).toEqual({ question: '', conversationId: 'c-1', confirmation: { proposalId: 'p-01', cancel: true } })
    // While the cancel is out, the card takes no second tap.
    expect(cardState(store.getState().conv, 0, store.getState().inFlight)).toBe('sending')
    d.calls[1].answer({ conversationId: 'c-1', questionNo: 2, outcome: 'cancelled', answer: 'Cancelled. Nothing was scheduled.' })
    await cancelled
    expect(cardState(store.getState().conv, 0)).toBe('cancelled')
    expect(store.getState().conv.turns[1].confirms).toEqual({ proposalId: 'p-01', cancel: true })
  })

  it('expiredAnswer_theCardShowsNoButton', async () => {
    const { d, store, card } = await withProposal()
    const confirmed = store.getState().confirm(card, card.values)
    d.calls[1].answer({ conversationId: 'c-1', questionNo: 2, outcome: 'expired', answer: 'This offer has expired. Ask again.' })
    await confirmed
    expect(cardState(store.getState().conv, 0)).toBe('expired')
    expect(cardLive(cardState(store.getState().conv, 0))).toBe(false)
  })

  it('aNewerProposal_replacesTheOlderOne_whichReadsAsExpired', async () => {
    const { d, store } = await withProposal()
    const again = store.getState().ask('and send me the stores daily')
    d.calls[1].answer(proposed({ questionNo: 3, proposal: { ...PROPOSAL, id: 'p-02' } }))
    await again
    expect(cardState(store.getState().conv, 0)).toBe('expired')
    expect(cardState(store.getState().conv, 1)).toBe('open')
  })

  it('notConfirmedOrARefusal_keepsTheCardOpen', async () => {
    const { d, store, card } = await withProposal()
    const first = store.getState().confirm(card, card.values)
    d.calls[1].answer({ conversationId: 'c-1', questionNo: 2, outcome: 'not-confirmed', answer: 'You hold 5 of 5.', scheduleRefusal: { reason: 'limit', limit: 5, held: 5 } })
    await first
    expect(cardState(store.getState().conv, 0)).toBe('open')
    const second = store.getState().confirm(card, { ...card.values, time: '25:00' })
    // COPILOT-440: the card's values are not a valid schedule. The reader mends them and confirms again.
    d.calls[2].refuse(new ApiError('business', 'Not a valid schedule.', 400, [{ errorCode: 'COPILOT-440', internalErrorCode: '', errorMessage: 'Not a valid schedule.' }]))
    await second
    expect(store.getState().conv.turns[2].confirms).toEqual({ proposalId: 'p-01', cancel: false })
    expect(cardState(store.getState().conv, 0)).toBe('open')
  })

  it('confirmed_showsTheServersSentenceWithTheFirstSendAndTheLinkToMySchedules', async () => {
    const { d, store, card } = await withProposal()
    const sentence = 'Done. "Weekly sales" will be sent to you every Monday at 07:00 Riyadh time.'
    const confirmed = store.getState().confirm(card, card.values)
    d.calls[1].answer({
      conversationId: 'c-1',
      questionNo: 2,
      outcome: 'confirmed',
      answer: sentence,
      confirmed: { scheduleId: 's-1', reportId: 'r-1', firstSendAt: '2026-11-16T07:00:00' },
    })
    expect((await confirmed)?.outcome).toBe('confirmed')
    expect(cardState(store.getState().conv, 0)).toBe('confirmed')
    const turn = store.getState().conv.turns[1]
    expect(confirmedNote(turn.reply)).toEqual({ firstSendAt: '2026-11-16T07:00:00', href: MY_SCHEDULES_PATH })
    expect(turn.reply?.answer).toBe(sentence)
    // Any other answer has no such note.
    expect(confirmedNote(store.getState().conv.turns[0].reply)).toBeNull()
  })
})

describe('no proposal, no card; an Arabic screen (885)', () => {
  it('anAnswerWithNoProposal_drawsAsToday', () => {
    // The switch off: `proposal` is absent, and the answer is an ordinary one.
    const plain: Partial<CopilotAnswer> = { conversationId: 'c-1', questionNo: 1, outcome: 'answered', answer: 'Sales were up.' }
    expect(proposalCard(plain, 'en')).toBeNull()
    expect(cardState({ id: 'c-1', over: false, turns: [{ question: 'q', questionNo: 1, reply: plain as CopilotAnswer, refusal: null }] }, 0)).toBe('none')
    // A `proposed` outcome missing its proposal, or a kind this ticket does not draw (887's pause/delete), has no card.
    expect(proposalCard(proposed({ proposal: undefined }), 'en')).toBeNull()
    expect(proposalCard(proposed({ proposal: { ...PROPOSAL, kind: 'pause' } }), 'en')).toBeNull()
    // A proposal on an answer whose outcome is not `proposed` is not drawn either.
    expect(proposalCard({ ...proposed(), outcome: 'answered' }, 'en')).toBeNull()
  })

  it('arabicScreen_theCardIsRightToLeftWithTheArabicLines', () => {
    const card = proposalCard(proposed(), 'ar')!
    expect(card.dir).toBe('rtl')
    expect(card.lines).toEqual([
      'ماذا: المبيعات حسب المدينة الأسبوع الماضي',
      '- المبيعات حسب المدينة',
      'متى: كل يوم الاثنين الساعة 07:00 بتوقيت الرياض',
      'الأرقام: الأيام السبعة قبل كل إرسال',
      'إلى: أنت فقط، على reader@example.com',
    ])
    expect(card.periodChoices.map((c) => c.label)).toEqual(['نفس عدد الأيام', 'نفس التواريخ'])
    // The confirmation still names the proposal's own language, not the screen's.
    expect(card.lang).toBe('en')
  })

  it('aRelativePeriod_offersNoChoice_andConfirmSendsNone', async () => {
    const relative = proposed({ proposal: { ...PROPOSAL, values: { ...PROPOSAL.values, periodChoice: null, periodChoices: null } } })
    const card = proposalCard(relative, 'en')!
    expect(card.periodChoices).toEqual([])
    expect(card.values.periodChoice).toBeNull()
    expect(confirmationBody('c-1', card, card.values).confirmation?.values).not.toHaveProperty('periodChoice')
  })
})

describe('editing the card (885, S17)', () => {
  it('theCadenceAndDayEdits_keepAConfirmableCard', () => {
    const card = proposalCard(proposed(), 'en')!
    const twoDays = withDay(card.values, 'thu')
    expect(twoDays.cadence).toEqual({ kind: 'weekly', days: ['mon', 'thu'], day: null })
    // Taking the last day off leaves a weekly card with none: Confirm waits for a day.
    const none = withDay(card.values, 'mon')
    expect(none.cadence.days).toEqual([])
    expect(cardReady(none)).toBe(false)
    // Monthly asks for a day of the month, starting on the 1st; daily needs neither.
    expect(withCadence(card.values, 'monthly').cadence).toEqual({ kind: 'monthly', days: null, day: '1' })
    expect(withCadence(card.values, 'daily').cadence).toEqual({ kind: 'daily', days: null, day: null })
    // Back to weekly from daily starts on Monday, the copilot's own example.
    expect(withCadence(withCadence(card.values, 'daily'), 'weekly').cadence).toEqual({ kind: 'weekly', days: ['mon'], day: null })
    expect(cardReady({ ...card.values, title: '  ' })).toBe(false)
    expect(cardReady({ ...card.values, time: '7' })).toBe(false)
    expect(cardReady(card.values)).toBe(true)
  })
})
