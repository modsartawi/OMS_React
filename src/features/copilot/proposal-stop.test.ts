import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { MY_SCHEDULES_PATH } from '@/core/analytics-routes'
import type { CopilotAnswer, CopilotAskRequest, CopilotProposal } from '@/core/models/copilot'
import { createCopilotConversation } from './conversation-store'
import { cardReady, cardState, choiceProblem, proposalCard, stoppedNote } from './proposal'

/** "Stop sending me the Riyadh one": one match, as BackOffice 3665 writes the card. */
const PAUSE_ONE: CopilotProposal = {
  id: 'p-pause',
  kind: 'pause',
  lines: [
    { en: 'Pause: Riyadh deliveries', ar: 'إيقاف مؤقت: Riyadh deliveries' },
    {
      en: 'Sent: every Monday at 07:00 Riyadh time',
      ar: 'يُرسل: كل يوم الاثنين الساعة 07:00 بتوقيت الرياض',
    },
    {
      en: 'Nothing is sent while it is paused. You can resume it in My schedules.',
      ar: 'لا يُرسل شيء أثناء الإيقاف. يمكنك استئنافه من «جداولي».',
    },
  ],
  values: {
    title: 'Riyadh deliveries',
    cadence: { kind: 'weekly', days: ['mon'], day: null },
    time: '07:00',
    lang: 'en',
    periodChoice: null,
    periodChoices: null,
    choice: 's-riyadh',
  },
  choices: [
    {
      id: 's-riyadh',
      title: { en: 'Riyadh deliveries', ar: 'Riyadh deliveries' },
      when: {
        en: 'every Monday at 07:00 Riyadh time',
        ar: 'كل يوم الاثنين الساعة 07:00 بتوقيت الرياض',
      },
      paused: false,
    },
  ],
}

const SALES = {
  id: 's-sales',
  title: { en: 'Sales by city', ar: 'Sales by city' },
  when: {
    en: 'every day at 07:00 Riyadh time',
    ar: 'كل يوم الساعة 07:00 بتوقيت الرياض',
  },
  paused: false,
}
const STORES = {
  id: 's-stores',
  title: { en: 'Sales by store', ar: 'Sales by store' },
  when: {
    en: 'every Sunday at 08:00 Riyadh time',
    ar: 'كل يوم الأحد الساعة 08:00 بتوقيت الرياض',
  },
  paused: false,
}

/** "Delete my sales one": two matches, the reader must choose. */
const DELETE_TWO: CopilotProposal = {
  id: 'p-delete',
  kind: 'delete',
  lines: [
    { en: 'Delete one of these:', ar: 'احذف واحدًا من هذه:' },
    {
      en: '- Sales by city, every day at 07:00 Riyadh time',
      ar: '- Sales by city، كل يوم الساعة 07:00 بتوقيت الرياض',
    },
    {
      en: '- Sales by store, every Sunday at 08:00 Riyadh time',
      ar: '- Sales by store، كل يوم الأحد الساعة 08:00 بتوقيت الرياض',
    },
    {
      en: 'The schedule and the report made for it are deleted.',
      ar: 'يُحذف الجدول والتقرير الذي أُعدّ له.',
    },
  ],
  values: {
    title: '',
    cadence: { kind: 'daily', days: null, day: null },
    time: '',
    lang: 'en',
    periodChoice: null,
    periodChoices: null,
  },
  choices: [SALES, STORES],
}

const proposed = (proposal: CopilotProposal): Partial<CopilotAnswer> => ({
  conversationId: 'c-1',
  questionNo: 2,
  outcome: 'proposed',
  answer: 'Here is the change I can make for you.',
  proposal,
})

/** A `Copilot/Ask` stand-in the test answers by hand. */
function door() {
  const calls: {
    body: CopilotAskRequest
    answer: (r: Partial<CopilotAnswer>) => void
    refuse: (e: unknown) => void
  }[] = []
  const ask = ({ requestId: _id, ...body }: CopilotAskRequest) =>
    new Promise<CopilotAnswer>((answer, refuse) => {
      calls.push({
        body,
        refuse,
        answer: (r) =>
          answer({
            orderRefs: [],
            trace: [],
            stoppedEarly: false,
            servedBy: '',
            askedAt: '',
            ...r,
          } as CopilotAnswer),
      })
    })
  return { ask, calls }
}

async function withProposal(proposal: CopilotProposal, lang = 'en') {
  const d = door()
  const store = createCopilotConversation(d.ask)
  const asked = store.getState().ask('stop sending me that')
  d.calls[0].answer(proposed(proposal))
  await asked
  return {
    d,
    store,
    card: proposalCard(store.getState().conv.turns[0].reply, lang)!,
  }
}

describe('a pause card with one match (887, BackOffice 3665)', () => {
  it('pauseCard_oneMatch_namesTheScheduleAndConfirmsIt', async () => {
    const { d, store, card } = await withProposal(PAUSE_ONE)
    expect(card.kind).toBe('pause')
    expect(card.destructive).toBe(false)
    expect(card.lines).toEqual([
      'Pause: Riyadh deliveries',
      'Sent: every Monday at 07:00 Riyadh time',
      'Nothing is sent while it is paused. You can resume it in My schedules.',
    ])
    expect(card.choices.map((c) => c.id)).toEqual(['s-riyadh'])
    expect(card.values.choice).toBe('s-riyadh')
    expect(cardReady(card.values, card)).toBe(true)
    // One choice: the proposal's id alone is sent (the server takes the card's only choice).
    const confirmed = store.getState().confirm(card, card.values)
    expect(d.calls[1].body).toEqual({
      question: '',
      conversationId: 'c-1',
      confirmation: { proposalId: 'p-pause', values: {} },
    })
    const sentence = 'Paused. "Riyadh deliveries" will not be sent until you resume it in My schedules.'
    d.calls[1].answer({
      conversationId: 'c-1',
      questionNo: 2,
      outcome: 'confirmed',
      answer: sentence,
      stopped: {
        kind: 'pause',
        scheduleId: 's-riyadh',
        title: 'Riyadh deliveries',
      },
    })
    expect((await confirmed)?.outcome).toBe('confirmed')
    expect(cardState(store.getState().conv, 0)).toBe('confirmed')
    const turn = store.getState().conv.turns[1]
    expect(turn.reply?.answer).toBe(sentence)
    expect(stoppedNote(turn.reply)).toEqual({
      kind: 'pause',
      title: 'Riyadh deliveries',
      href: MY_SCHEDULES_PATH,
    })
    expect(stoppedNote(store.getState().conv.turns[0].reply)).toBeNull()
  })

  it('arabicScreen_thePauseCardIsRightToLeftWithTheArabicWords', async () => {
    const { card } = await withProposal(PAUSE_ONE, 'ar')
    expect(card.dir).toBe('rtl')
    expect(card.lines[0]).toBe('إيقاف مؤقت: Riyadh deliveries')
    expect(card.choices[0].when).toBe('كل يوم الاثنين الساعة 07:00 بتوقيت الرياض')
  })

  it('goneMeanwhile_notConfirmedNotFound_keepsTheCardOpen', async () => {
    const { d, store, card } = await withProposal(PAUSE_ONE)
    const sent = store.getState().confirm(card, card.values)
    d.calls[1].answer({
      conversationId: 'c-1',
      questionNo: 2,
      outcome: 'not-confirmed',
      answer: 'Nothing was changed: that schedule no longer exists.',
      scheduleRefusal: { reason: 'notFound' },
    })
    await sent
    expect(cardState(store.getState().conv, 0)).toBe('open')
    expect(stoppedNote(store.getState().conv.turns[1].reply)).toBeNull()
  })
})

describe('a card with choices (887, BackOffice 3665)', () => {
  it('severalMatches_confirmWaitsForAChoice_andSendsTheChosenOne', async () => {
    const { d, store, card } = await withProposal(DELETE_TWO)
    // The choices are drawn as a list, so the server's dash lines are not drawn twice.
    expect(card.lines).toEqual(['Delete one of these:', 'The schedule and the report made for it are deleted.'])
    expect(card.choices).toEqual([
      {
        id: 's-sales',
        title: 'Sales by city',
        when: 'every day at 07:00 Riyadh time',
        paused: false,
      },
      {
        id: 's-stores',
        title: 'Sales by store',
        when: 'every Sunday at 08:00 Riyadh time',
        paused: false,
      },
    ])
    expect(card.values.choice).toBeNull()
    expect(cardReady(card.values, card)).toBe(false)
    // A choice the card did not offer is no choice.
    expect(cardReady({ ...card.values, choice: 's-other' }, card)).toBe(false)
    const picked = { ...card.values, choice: 's-stores' }
    expect(cardReady(picked, card)).toBe(true)
    store.getState().confirm(card, picked)
    expect(d.calls[1].body).toEqual({
      question: '',
      conversationId: 'c-1',
      confirmation: { proposalId: 'p-delete', values: { choice: 's-stores' } },
    })
  })

  it('copilot441_showsTheServersMessageBesideTheChoices_andTheCardStaysOpen', async () => {
    const { d, store, card } = await withProposal(DELETE_TWO)
    const sent = store.getState().confirm(card, { ...card.values, choice: 's-stores' })
    const message = 'Choose one of the schedules on the card.'
    d.calls[1].refuse(
      new ApiError(
        'business',
        message,
        400,
        [
          {
            errorCode: 'COPILOT-441',
            internalErrorCode: '',
            errorMessage: message,
          },
        ],
        {
          problems: [{ field: 'choice', reason: 'badChoice', message }],
          proposal: DELETE_TWO,
        },
      ),
    )
    await sent
    expect(cardState(store.getState().conv, 0)).toBe('open')
    expect(choiceProblem(store.getState().conv, 'p-delete')).toBe(message)
    // Picked again and confirmed: the problem was the last answer's, not the card's to keep.
    const again = store.getState().confirm(card, { ...card.values, choice: 's-sales' })
    d.calls[2].answer({
      conversationId: 'c-1',
      questionNo: 2,
      outcome: 'confirmed',
      answer: 'Deleted.',
      stopped: {
        kind: 'delete',
        scheduleId: 's-sales',
        title: 'Sales by city',
      },
    })
    await again
    expect(choiceProblem(store.getState().conv, 'p-delete')).toBeNull()
  })
})

describe('a delete card (887, BackOffice 3665)', () => {
  it('deleteCard_saysTheReportIsDeletedWithIt_andItsConfirmIsDestructive', async () => {
    const one: CopilotProposal = {
      ...DELETE_TWO,
      lines: [
        { en: 'Delete: Sales by city', ar: 'حذف: Sales by city' },
        {
          en: 'Sent: every day at 07:00 Riyadh time',
          ar: 'يُرسل: كل يوم الساعة 07:00 بتوقيت الرياض',
        },
        DELETE_TWO.lines[3],
      ],
      values: {
        ...DELETE_TWO.values,
        title: 'Sales by city',
        choice: 's-sales',
      },
      choices: [SALES],
    }
    const { d, store, card } = await withProposal(one)
    expect(card.kind).toBe('delete')
    expect(card.destructive).toBe(true)
    expect(card.lines).toContain('The schedule and the report made for it are deleted.')
    expect(proposalCard(proposed(one), 'ar')!.lines).toContain('يُحذف الجدول والتقرير الذي أُعدّ له.')
    const done = store.getState().confirm(card, card.values)
    d.calls[1].answer({
      conversationId: 'c-1',
      questionNo: 2,
      outcome: 'confirmed',
      answer: 'Deleted. "Sales by city" will no longer be sent, and the report made for it is deleted.',
      stopped: {
        kind: 'delete',
        scheduleId: 's-sales',
        title: 'Sales by city',
      },
    })
    await done
    expect(stoppedNote(store.getState().conv.turns[1].reply)).toEqual({
      kind: 'delete',
      title: 'Sales by city',
      href: MY_SCHEDULES_PATH,
    })
  })
})
