import { describe, expect, it } from 'vitest'
import type { DispatchScorecardCardMeasure, DispatchScorecardDrillRow } from '@/core/models/dispatch-scorecard'
import {
  STAFF_COLUMNS,
  STORE_COLUMNS,
  STORE_RANK_FIELD,
  cardMedianText,
  cardRank,
  compareRanked,
  directionLabelKey,
  drillPath,
  formatMeasure,
  tooFewLast,
} from './figures'

/** Sorts as AG Grid does: the comparator's answer, negated when descending. */
function gridSort<T extends { v: number | null; few: boolean }>(rows: T[], descending: boolean): T[] {
  return [...rows].sort((a, b) => {
    const r = compareRanked(a.v, b.v, a.few, b.few, descending)
    return descending ? -r : r
  })
}

describe('direction labels', () => {
  it('each of the six store measures is labelled with its better direction (ruling 2948 D4, spec 3326)', () => {
    const ranked = STORE_COLUMNS.filter((c) => c.ranked).map((c) => [c.field, c.better && directionLabelKey(c.better)])
    expect(ranked).toEqual([
      ['ignoreRate', 'direction.lower'],
      ['medianAnswerSeconds', 'direction.lower'],
      ['slowQuarterAnswerSeconds', 'direction.lower'],
      ['winRate', 'direction.higher'],
      ['declineRate', 'direction.lower'],
      ['failedTakeRate', 'direction.lower'],
    ])
  })

  it('the Staff tab ranks only the two answer times, both lower-is-better (D6)', () => {
    const ranked = STAFF_COLUMNS.filter((c) => c.ranked).map((c) => [c.field, c.better && directionLabelKey(c.better)])
    expect(ranked).toEqual([
      ['medianAnswerSeconds', 'direction.lower'],
      ['slowQuarterAnswerSeconds', 'direction.lower'],
    ])
  })
})

describe('compareRanked', () => {
  const rows = [
    { id: 'a', v: 0.2, few: false },
    { id: 'b', v: null, few: false },
    { id: 'c', v: 0.05, few: false },
    { id: 'd', v: 0.01, few: true },
    { id: 'e', v: 0.5, few: false },
  ]

  it('🚩 ascending: the figures low to high, an absent one after them, the too-few rows last', () => {
    expect(gridSort(rows, false).map((r) => r.id)).toEqual(['c', 'a', 'e', 'b', 'd'])
  })

  it('🚩 descending: the figures high to low, an absent one STILL after them, the too-few rows STILL last', () => {
    expect(gridSort(rows, true).map((r) => r.id)).toEqual(['e', 'a', 'c', 'b', 'd'])
  })

  it('two too-few rows sort among themselves by figure, absent last', () => {
    const few = [
      { id: 'x', v: null, few: true },
      { id: 'y', v: 3, few: true },
      { id: 'z', v: 1, few: true },
    ]
    expect(gridSort(few, false).map((r) => r.id)).toEqual(['z', 'y', 'x'])
    expect(gridSort(few, true).map((r) => r.id)).toEqual(['y', 'z', 'x'])
  })
})

describe('tooFewLast', () => {
  it('keeps the server order and moves the too-few rows after the rest, in their order', () => {
    const rows = [
      { store: 'P001', tooFew: true },
      { store: 'P002', tooFew: false },
      { store: 'P003', tooFew: true },
      { store: 'P004', tooFew: false },
    ]
    expect(tooFewLast(rows).map((r) => r.store)).toEqual(['P002', 'P004', 'P001', 'P003'])
  })
})

describe('context columns', () => {
  it('🚩 a context column is never sortable as a rank — only the six measures sort', () => {
    expect(STORE_COLUMNS.filter((c) => c.sortable).map((c) => c.field)).toEqual([
      'ignoreRate',
      'medianAnswerSeconds',
      'slowQuarterAnswerSeconds',
      'winRate',
      'declineRate',
      'failedTakeRate',
    ])
    expect(STORE_COLUMNS.filter((c) => !c.ranked).every((c) => !c.sortable && c.better === undefined)).toBe(true)
  })

  it('names the 2948 D5 context, refused closes right beside the failed-take rate (BO 3339), then failed takes and fallback cancels', () => {
    expect(STORE_COLUMNS.filter((c) => !c.ranked).map((c) => c.field)).toEqual([
      'refusedCloses',
      'bids',
      'beaten',
      'lostRaces',
      'passedShort',
      'passedUnknown',
      'darkOffers',
      'unseen',
      'medianKm',
      'fallbacksReceived',
      'fallbackCancels',
      'failedTakes',
      'releasedAfterAward',
    ])
  })

  it('🚩 the failed-take rate sits right after the decline rate, refused closes right beside it', () => {
    const fields = STORE_COLUMNS.map((c) => c.field)
    expect(fields.slice(4, 7)).toEqual(['declineRate', 'failedTakeRate', 'refusedCloses'])
  })

  it('every ranked figure, lost races, and the three spec 3326 context figures open the drill — by their own field name', () => {
    expect(STORE_COLUMNS.filter((c) => c.drill).map((c) => c.drill)).toEqual([
      'ignoreRate',
      'medianAnswerSeconds',
      'slowQuarterAnswerSeconds',
      'winRate',
      'declineRate',
      'failedTakeRate',
      'refusedCloses',
      'lostRaces',
      'fallbackCancels',
      'failedTakes',
    ])
  })

  it('every ranked store measure has its rank field as the door names it — failedTakeRank, not failedTakeRateRank', () => {
    expect(STORE_RANK_FIELD.failedTakeRate).toBe('failedTakeRank')
  })

  it('the Staff tab never ranks Won, lost races or Passed with stock', () => {
    expect(STAFF_COLUMNS.filter((c) => !c.ranked).every((c) => !c.sortable)).toBe(true)
    expect(STAFF_COLUMNS.map((c) => c.field)).toEqual([
      'won',
      'lostRaces',
      'passedWithStock',
      'medianAnswerSeconds',
      'slowQuarterAnswerSeconds',
      'answers',
      'failedTakes',
      'failedTakeRate',
      'refusedCloses',
    ])
  })

  it('🚩 the staff failed-take rate never ranks: no rank, no sort, no direction — but it and its neighbours drill', () => {
    const plan = Object.fromEntries(STAFF_COLUMNS.map((c) => [c.field, c]))
    for (const f of ['failedTakes', 'failedTakeRate', 'refusedCloses']) {
      expect(plan[f]).toEqual({ field: f, ranked: false, sortable: false, drill: f })
    }
  })
})

describe('the failed-take rate sorts', () => {
  // A store with no wins sends a null rate (spec 3326): it must never read as the best.
  const rows = [
    { id: 'noWins', v: null, few: false },
    { id: 'clean', v: 0, few: false },
    { id: 'some', v: 0.12, few: false },
    { id: 'bad', v: 0.4, few: false },
  ]

  it('🚩 ascending (best first): a null rate is LAST, never ranked first', () => {
    expect(gridSort(rows, false).map((r) => r.id)).toEqual(['clean', 'some', 'bad', 'noWins'])
  })

  it('🚩 descending (worst first): a null rate is STILL last', () => {
    expect(gridSort(rows, true).map((r) => r.id)).toEqual(['bad', 'some', 'clean', 'noWins'])
  })
})

describe('formatMeasure', () => {
  it('a rate (0..1 as sent) reads as a percent with one decimal', () => {
    expect(formatMeasure('ignoreRate', 0.1234, '—')).toBe('12.3%')
    expect(formatMeasure('winRate', 0, '—')).toBe('0.0%')
    expect(formatMeasure('failedTakeRate', 0.0625, '—')).toBe('6.3%')
  })

  it('an answer time reads in seconds under a minute, else m:ss', () => {
    expect(formatMeasure('medianAnswerSeconds', 42.4, '—')).toBe('42 s')
    expect(formatMeasure('slowQuarterAnswerSeconds', 125.6, '—')).toBe('2:06')
  })

  it('an absent figure reads the dash, never 0', () => {
    expect(formatMeasure('declineRate', null, '—')).toBe('—')
    expect(formatMeasure('medianAnswerSeconds', null, '—')).toBe('—')
    expect(formatMeasure('failedTakeRate', null, '—')).toBe('—')
    // A server not yet on spec 3326 sends no field at all.
    expect(formatMeasure('failedTakeRate', undefined, '—')).toBe('—')
  })
})

const measure = (over: Partial<DispatchScorecardCardMeasure>): DispatchScorecardCardMeasure => ({
  measure: 'ignoreRate',
  value: 0.08,
  rank: 3,
  of: 17,
  estateMedian: 0.115,
  better: 'lower',
  ...over,
})

describe('the store card', () => {
  it('🚩 "#n of m" is the rank and the count AS SENT — never recomputed', () => {
    expect(cardRank(measure({ rank: 3, of: 17 }))).toEqual({ ranked: true, rank: '3', of: '17' })
  })

  it('an unranked measure (too few, or no figure) says so', () => {
    expect(cardRank(measure({ rank: null, of: 17 }))).toEqual({ ranked: false })
  })

  it('🚩 the estate median is the one sent, formatted as its measure', () => {
    expect(cardMedianText(measure({ estateMedian: 0.115 }), '—')).toBe('11.5%')
    expect(cardMedianText(measure({ measure: 'medianAnswerSeconds', estateMedian: 61 }), '—')).toBe('1:01')
    expect(cardMedianText(measure({ estateMedian: null }), '—')).toBe('—')
    expect(cardMedianText(measure({ measure: 'failedTakeRate', estateMedian: 0.031 }), '—')).toBe('3.1%')
  })
})

const drillRow = (over: Partial<DispatchScorecardDrillRow>): DispatchScorecardDrillRow => ({
  calloutId: 'C1',
  bidId: 'B1',
  subjectType: 'DELIVERY',
  subjectId: '8006777365',
  party: 'P001',
  class: 'Won',
  ignoreReason: '',
  offeredAt: '2026-10-20T09:00:00',
  deliveredAt: null,
  answeredAt: null,
  answerSeconds: null,
  answeredBy: '',
  answeredRegister: '',
  awardedAt: null,
  nearMiss: false,
  distanceKm: 2.4,
  onlineTills: 2,
  signedInTills: 1,
  atp: 'covers',
  releaseReason: '',
  counted: true,
  ...over,
})

describe('drillPath', () => {
  it('a bid on a delivery opens that delivery', () => {
    expect(drillPath(drillRow({ subjectId: '8006777365' }))).toBe('/oms/delivery/8006777365')
  })

  it('a subject that is not a delivery, or has no id, opens nothing', () => {
    expect(drillPath(drillRow({ subjectType: 'ORDER' }))).toBeNull()
    expect(drillPath(drillRow({ subjectId: '  ' }))).toBeNull()
  })
})
