import { describe, expect, it } from 'vitest'
import type { CopilotAnswer } from '@/core/models/copilot'
import { COPILOT_MAX_QUESTION, copilotAnswerModel, questionFits } from './answer'

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

describe('the question limit (spec 734 D7)', () => {
  it('copilotQuestion_holdsAtMostAThousandCharacters', () => {
    expect(COPILOT_MAX_QUESTION).toBe(1000)
    expect(questionFits('a'.repeat(1000))).toBe(true)
    expect(questionFits('a'.repeat(1001))).toBe(false)
    expect(questionFits('   ')).toBe(false)
  })
})
