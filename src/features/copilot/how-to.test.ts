/**
 * oms 952 (BackOffice spec 4182 §D, story 18): the empty panel's "How do I…?" row — two or three questions from the
 * help's table of contents, in the help language, each asked on a tap. Separate from the curator-edited starters.
 */
import { describe, expect, it } from 'vitest'
import { howToQuestions } from '@/core/help/how-to'
import type { HelpContents } from '@/core/models/help'
import { howToButtons } from './starters'

const article = (slug: string, questions: string[]) => ({ slug, title: slug, order: 0, access: ['viewer' as const], screens: [], questions, checkedAgainst: '' })

const EN: HelpContents = {
  draft: true,
  tours: [],
  articles: [
    article('start', ['How do I find a board?']),
    article('boards', ['How do I share a board?', 'How do I pin a board?']),
    article('reports', ['How do I schedule a report?', '  ']),
  ],
}
const AR: HelpContents = {
  draft: true,
  tours: [],
  articles: [article('start', ['كيف أجد لوحة؟']), article('boards', ['كيف أشارك لوحة؟', 'كيف أثبّت لوحة؟'])],
}

/** A fixed sequence standing in for `Math.random`. */
const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('the "How do I…?" row', () => {
  it('picks three different questions from the contents, never a blank one', () => {
    const picked = howToQuestions(EN, seq(0, 0, 0))
    expect(picked).toEqual(['How do I find a board?', 'How do I share a board?', 'How do I pin a board?'])
    const other = howToQuestions(EN, seq(0.99, 0.99, 0.99))
    expect(other).toEqual(['How do I schedule a report?', 'How do I pin a board?', 'How do I share a board?'])
  })

  it('reads the contents of the help language: Arabic contents give Arabic questions', () => {
    expect(howToQuestions(AR, seq(0, 0, 0))).toEqual(['كيف أجد لوحة؟', 'كيف أشارك لوحة؟', 'كيف أثبّت لوحة؟'])
  })

  it('offers fewer when the contents hold fewer, and none without contents', () => {
    expect(howToQuestions({ draft: false, tours: [], articles: [article('start', ['How do I start?'])] }, Math.random)).toEqual(['How do I start?'])
    expect(howToQuestions(undefined, Math.random)).toEqual([])
  })

  it('asks the question on a tap', () => {
    expect(howToButtons(['كيف أشارك لوحة؟'])).toEqual([{ text: 'كيف أشارك لوحة؟', tap: { kind: 'ask', question: 'كيف أشارك لوحة؟', origin: 'starter' } }])
  })
})
