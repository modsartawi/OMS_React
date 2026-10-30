/**
 * Ticket 689 — the lessons ship as static experiments in the 687 codec: each decodes through it, carries an
 * assertion, and has its EN and AR title and explanation.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-playground.json'
import ar from '@/locales/ar/insurance-playground.json'
import { hasLocaleKey } from '@/core/test/locale'
import { readExperiment } from '@/core/insurance-rules/experiment'
import { LESSONS, lessonExperiment } from './lessons'

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

  it.each([en, ar])('every lesson has its title and explanation', (locale) => {
    for (const l of LESSONS) for (const k of ['title', 'explain']) expect([l.id, k, hasLocaleKey(locale, `lessons.items.${l.id}.${k}`)]).toEqual([l.id, k, true])
  })
})
