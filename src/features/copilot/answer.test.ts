import { describe, expect, it } from 'vitest'
import type { CopilotAnswer } from '@/core/models/copilot'
import { COPILOT_MAX_QUESTION, copilotAnswerModel, orderSegments, questionFits, viewHref } from './answer'

describe('the answer view model (spec 734 D10, D11)', () => {
  it('copilotAnswerModel_readsABareAnswerAsEmpty', () => {
    // A reply missing `trace`, `orderRefs` and `answer` — what a young door or a partial
    // envelope can send — builds a model with nothing in it, and does not throw.
    const bare = { conversationId: 'c-1', questionNo: 1 } as Partial<CopilotAnswer>
    const model = copilotAnswerModel(bare)
    expect(model.blocks).toEqual([])
    expect(model.orderRefs).toEqual([])
    expect(model.trace).toEqual([])
    expect(model.stoppedEarly).toBe(false)
    expect(model.conversationId).toBe('c-1')

    // …and so does no reply at all, or one whose lists are not lists.
    expect(copilotAnswerModel(null).blocks).toEqual([])
    const odd = { answer: null, trace: 'x', orderRefs: 7 } as unknown as Partial<CopilotAnswer>
    expect(copilotAnswerModel(odd)).toMatchObject({ blocks: [], trace: [], orderRefs: [], conversationId: null })
  })

  it('copilotAnswerModel_readsParagraphsBulletsAndSimpleTables', () => {
    const answer = [
      'Order 1234 was 42 minutes late.',
      'The pick ran long.',
      '',
      '- Callout round 1 at 3 km',
      '* Round 2 widened to 6 km',
      '',
      '| Week | Orders |',
      '|---|---:|',
      '| This | 120 |',
      '| Last | 98 |',
      '',
      'That is all.',
    ].join('\n')
    expect(copilotAnswerModel({ answer }).blocks).toEqual([
      { kind: 'paragraph', text: 'Order 1234 was 42 minutes late.\nThe pick ran long.' },
      { kind: 'list', items: ['Callout round 1 at 3 km', 'Round 2 widened to 6 km'] },
      { kind: 'table', head: ['Week', 'Orders'], rows: [['This', '120'], ['Last', '98']] },
      { kind: 'paragraph', text: 'That is all.' },
    ])
  })
})

describe('the answer links its orders (spec 734 D10, D11; ticket 736)', () => {
  it('copilotAnswerModel_linksEveryOrderRef', () => {
    const model = copilotAnswerModel({
      answer: 'Order 7000123456 was late; 8000000253 was not.',
      orderRefs: ['7000123456', '8000000253', '123'],
    })
    // Every ref found in the text is a link segment, wherever it sits — twice, at the start, at the end.
    expect(orderSegments('7000123456 and 8000000253, then 7000123456', model.orderRefs)).toEqual([
      { kind: 'order', no: '7000123456' },
      { kind: 'text', text: ' and ' },
      { kind: 'order', no: '8000000253' },
      { kind: 'text', text: ', then ' },
      { kind: 'order', no: '7000123456' },
    ])
    // A ref inside a longer number is not that order: "123" never links part of 70001234567.
    expect(orderSegments('Store 70001234567 and order 123.', ['123'])).toEqual([
      { kind: 'text', text: 'Store 70001234567 and order ' },
      { kind: 'order', no: '123' },
      { kind: 'text', text: '.' },
    ])
    // Text without a ref stays plain, and no refs at all leaves the text whole.
    expect(orderSegments('No order here.', model.orderRefs)).toEqual([{ kind: 'text', text: 'No order here.' }])
    expect(orderSegments('Order 7000123456.', [])).toEqual([{ kind: 'text', text: 'Order 7000123456.' }])
    expect(orderSegments('', ['1'])).toEqual([])
  })
})

describe('the answer links the views it created (spec 766 D; ticket 781)', () => {
  it('answer_viewRefsBecomeOpenViewLinks_absentViewRefsReadAsEmpty', () => {
    const model = copilotAnswerModel({
      answer: 'I saved the chart as a view.',
      viewRefs: [
        { id: 'v-42', title: { en: 'Orders by channel, last 4 weeks', ar: 'الطلبات حسب القناة' } },
        { id: 'v 7/x', title: { en: 'Late orders', ar: '' } },
      ],
    } as Partial<CopilotAnswer>)
    // Each ref keeps its id and both titles, and links to its view by route string.
    expect(model.viewRefs).toEqual([
      { id: 'v-42', title: { en: 'Orders by channel, last 4 weeks', ar: 'الطلبات حسب القناة' } },
      { id: 'v 7/x', title: { en: 'Late orders', ar: '' } },
    ])
    expect(model.viewRefs.map((v) => viewHref(v.id))).toEqual(['/analytics/view/v-42', '/analytics/view/v%207%2Fx'])

    // A reply without viewRefs (every pre-3383 server) reads as none; so does one that is not a list.
    expect(copilotAnswerModel({ answer: 'x' }).viewRefs).toEqual([])
    expect(copilotAnswerModel(null).viewRefs).toEqual([])
    expect(copilotAnswerModel({ viewRefs: 'v-1' } as unknown as Partial<CopilotAnswer>).viewRefs).toEqual([])

    // A malformed ref is dropped (no id); a missing or partial title reads as blank text.
    const odd = {
      viewRefs: [null, { title: { en: 'No id' } }, { id: '' }, { id: 9 }, { id: 'v-3', title: { en: 'Only English' } }],
    } as unknown as Partial<CopilotAnswer>
    expect(copilotAnswerModel(odd).viewRefs).toEqual([
      { id: '9', title: { en: '', ar: '' } },
      { id: 'v-3', title: { en: 'Only English', ar: '' } },
    ])
  })
})

describe('the question limit (spec 734 D7)', () => {
  it('copilotQuestion_holdsAtMostAThousandCharacters', () => {
    expect(COPILOT_MAX_QUESTION).toBe(1000)
    expect(questionFits('a'.repeat(1000))).toBe(true)
    expect(questionFits('a'.repeat(1001))).toBe(false)
    expect(questionFits('   ')).toBe(false)
  })
})
