/**
 * oms 938 (BackOffice spec 4127, decisions 5 and 8) — the Index tab reads the price index with us at 100: a competitor
 * above 100 is dearer than us (fine), below 100 is cheaper than us (the warning). The lowest-price score is the flagged
 * materials over the counted ones, shown as a percent. The shelf/paid switch is which measure is queried.
 *
 * ⚠ The Cube members are GUESSED from BO 4132 (not built): the flipped `shelf_price_index` / `paid_price_index` and the
 * `lowest_price_score` view's `*_lowest_price_flagged` / `lowest_price_counted`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import '@/core/i18n'
import type { AnalyticsQueryResult } from '@/core/models/analytics'
import { answerBasis, asIndex, competitorIndexes, indexTone, lowestPriceScore, trendSlot } from './index-tab'
import { IndexFigure, ScoreTile } from './IndexTab'

describe('the price index with us at 100', () => {
  it('reads Cube\'s figure as an index by its unit: a share 1.10 is 110, an index 110 stays 110', () => {
    expect(asIndex(1.1, 'share')).toBeCloseTo(110)
    expect(asIndex(0.872, 'share')).toBeCloseTo(87.2)
    expect(asIndex(110, null)).toBe(110)
    expect(asIndex(null, 'share')).toBeNull()
  })

  it('calls a competitor above 100 dearer, below 100 cheaper, 100 level', () => {
    expect(indexTone(110)).toBe('dearer')
    expect(indexTone(87.2)).toBe('cheaper')
    expect(indexTone(100)).toBe('level')
    expect(indexTone(100.04)).toBe('level') // shown as 100.0
    expect(indexTone(null)).toBeNull()
  })

  it('renders an index above 100 as "they are dearer", below 100 as the warning', () => {
    const dearer = renderToStaticMarkup(createElement(IndexFigure, { index: 110 }))
    expect(dearer).toContain('data-index-tone="dearer"')
    expect(dearer).toContain('110.0')
    expect(dearer).toContain('They are dearer')

    const cheaper = renderToStaticMarkup(createElement(IndexFigure, { index: 87.2 }))
    expect(cheaper).toContain('data-index-tone="cheaper"')
    expect(cheaper).toContain('87.2')
    expect(cheaper).toContain('They are cheaper')
    // The warning severity's badge, not the fine one.
    expect(cheaper).toContain('data-index-sev="warn"')
    expect(dearer).toContain('data-index-sev="ok"')
  })
})

describe('the lowest-price score', () => {
  it('is flagged ÷ counted, unweighted; nothing counted is no score', () => {
    expect(lowestPriceScore(45, 60)).toBe(0.75)
    expect(lowestPriceScore(60, 60)).toBe(1)
    expect(lowestPriceScore(0, 60)).toBe(0)
    expect(lowestPriceScore(0, 0)).toBeNull()
    expect(lowestPriceScore(null, 60)).toBeNull()
  })

  it('shows the tile as a percent with the flagged and counted materials beside it', () => {
    const html = renderToStaticMarkup(createElement(ScoreTile, { label: 'All competitors', flagged: 45, counted: 60, spark: [] }))
    const words = html.replace(/<[^>]+>/g, '')
    expect(words).toContain('75.0%')
    expect(words).toContain('45 of 60 materials')
    expect(html).toContain('All competitors')
  })
})

describe('review fixes', () => {
  it('gives the trend a colour slot only within the palette; past it, ink grey (null)', () => {
    expect([0, 1, 4, 5, 9].map(trendSlot)).toEqual([0, 1, 4, null, null])
  })

  it('reads an answer by the basis it was asked on, not the switch’s new one', () => {
    const answer = (key: string): AnalyticsQueryResult =>
      ({ columns: [{ key: 'competitor' }, { key, unit: 'share' }], rows: [{ competitor: 'NAHDI', [key]: 1.1 }] }) as unknown as AnalyticsQueryResult
    expect(answerBasis(answer('paid_price_index'))).toBe('paid')
    expect(answerBasis(answer('shelf_lowest_price_flagged'))).toBe('shelf')
    expect(answerBasis(undefined)).toBeNull()
    // The kept-previous shelf answer, read while the switch already says paid, still has its figure.
    const kept = answer('shelf_price_index')
    expect(competitorIndexes(kept, answerBasis(kept) ?? 'paid')[0].index).toBeCloseTo(110)
  })

  it('isolates a competitor score tile’s code · name pair as a machine value', () => {
    const html = renderToStaticMarkup(createElement(ScoreTile, { label: 'NAHDI · Nahdi', pair: true, flagged: 1, counted: 2, spark: [] }))
    expect(html).toMatch(/<bdi dir="ltr">NAHDI · Nahdi<\/bdi>/)
  })
})
