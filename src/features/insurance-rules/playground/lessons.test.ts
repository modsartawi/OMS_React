/**
 * Ticket 689 — the lessons ship as static experiments in the 687 codec: each decodes through it, carries an
 * assertion, and has its EN and AR title and explanation.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-playground.json'
import ar from '@/locales/ar/insurance-playground.json'
import { hasLocaleKey } from '@/core/test/locale'
import { readExperiment } from '@/core/insurance-rules/experiment'
import { LESSONS, lessonById, lessonCompareSeed, lessonExperiment } from './lessons'

describe('lessons', () => {
  it('the first nine, in the order the brief lists them', () => {
    expect(LESSONS.map((l) => l.id)).toEqual([
      'unknownVsFalse',
      'groups',
      'quantityCap',
      'categoryOrder',
      'historyWindow',
      'benefit66',
      'otherPayer',
      'crossLine',
      'rawNearMiss',
    ])
  })

  it.each(LESSONS.map((l) => [l.id, l] as const))('%s decodes through the experiment codec', (_, lesson) => {
    const r = readExperiment(lesson.file)
    expect(r.ok).toBe(true)
    expect(lessonExperiment(lesson)).toEqual(r.ok ? r.experiment : null)
    expect(lesson.expects.length).toBeGreaterThan(0)
  })

  it('the Raw near-miss lesson is a Raw experiment; the others send data', () => {
    for (const l of LESSONS) expect([l.id, lessonExperiment(l).raw !== undefined]).toEqual([l.id, l.id === 'rawNearMiss'])
  })

  it('a lesson of each kind', () => {
    expect(new Set(LESSONS.map((l) => lessonExperiment(l).kind))).toEqual(new Set(['guard', 'coverage', 'category']))
  })

  it('lesson 7 ships a B side: the same rule and request at another payer, whose category 66 limit is 10,000', () => {
    const lesson = lessonById('otherPayer')
    if (!lesson) throw new Error('lesson 7')
    const a = lessonExperiment(lesson)
    const b = lessonCompareSeed(lesson)
    if (!b) throw new Error('a B side')
    const bData = JSON.parse(b.dataText)
    expect(b.dataTab).toBe('json')
    expect(JSON.parse(b.documentText)).toEqual(a.document)
    expect((a.data as { request: { payer: string } }).request.payer).toBe('0001100099')
    expect(bData.request.payer).toBe('0001100041')
    expect(bData.eligibility['benefit[66].approvalLimit'].number).toBe(10000)
    expect((a.data as { eligibility: Record<string, { number: number }> }).eligibility['benefit[66].approvalLimit'].number).toBe(100)
    // …and nothing else between A and B: the same lines, patient and history
    expect(bData.lines).toEqual((a.data as { lines: unknown }).lines)
  })

  it('only lesson 7 opens Compare', () => {
    expect(LESSONS.filter((l) => lessonCompareSeed(l) !== null).map((l) => l.id)).toEqual(['otherPayer'])
  })

  it.each([en, ar])('every lesson has its title and explanation', (locale) => {
    for (const l of LESSONS) for (const k of ['title', 'explain']) expect([l.id, k, hasLocaleKey(locale, `lessons.items.${l.id}.${k}`)]).toEqual([l.id, k, true])
  })
})
