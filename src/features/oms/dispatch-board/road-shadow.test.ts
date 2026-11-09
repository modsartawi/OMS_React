/**
 * Ticket 859 — the road Shadow report's view: the shares, the fallback total and its warning, the reasons in words,
 * the median, the empty range, and the filters in the URL. Expected values are worked by hand.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/dispatch-board.json'
import ar from '@/locales/ar/dispatch-board.json'
import type { RoadShadowReport } from '@/core/models/dispatch-board'
import {
  DEFAULT_SHADOW_TYPE,
  KNOWN_FALLBACK_REASONS,
  fallbackReason,
  fallbackSummary,
  formatShare,
  pickRangeEnd,
  headlineTiles,
  isEmptyRange,
  medianReading,
  resolveShadowRange,
  shadowFiltersFromParams,
  shadowFiltersToParams,
  shadowWire,
} from './road-shadow'

const report = (over: Partial<RoadShadowReport> = {}): RoadShadowReport => ({
  asOf: '2026-11-08T10:00:00',
  from: '2026-11-02T00:00:00',
  to: '2026-11-08T00:00:00',
  type: 'QC',
  measured: 0,
  fallbacks: [],
  roadWouldRemoveBids: 0,
  roadWouldWiden: 0,
  competedWouldDiffer: 0,
  measuredBids: 0,
  medianRoadToStraightRatio: null,
  ...over,
})

const at = (locale: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale)

describe('formatShare', () => {
  it('formatShare_aPart_isAPercentToOnePlaceWithoutATrailingZero', () => {
    expect(formatShare(3, 40, '—')).toBe('7.5%')
    expect(formatShare(10, 40, '—')).toBe('25%')
    expect(formatShare(1, 3, '—')).toBe('33.3%')
    expect(formatShare(0, 40, '—')).toBe('0%')
  })

  it('formatShare_ofZero_isADashAndNeverDividesByZero', () => {
    expect(formatShare(0, 0, '—')).toBe('—')
    expect(formatShare(5, 0, '—')).toBe('—')
  })
})

describe('headlineTiles', () => {
  it('headlineTiles_areTheFourCountsInOrder_eachWithItsShareOfMeasured', () => {
    const tiles = headlineTiles(report({ measured: 200, roadWouldRemoveBids: 14, roadWouldWiden: 30, competedWouldDiffer: 9 }), '—')
    expect(tiles).toEqual([
      { key: 'measured', value: 200, share: '100%' },
      { key: 'removed', value: 14, share: '7%' },
      { key: 'widened', value: 30, share: '15%' },
      { key: 'competed', value: 9, share: '4.5%' },
    ])
  })

  it('headlineTiles_withNothingMeasured_showADashForEveryShare', () => {
    expect(headlineTiles(report(), '—').map((t) => t.share)).toEqual(['—', '—', '—', '—'])
  })
})

describe('fallbackSummary', () => {
  it('fallbackSummary_totalsTheReasons_andTakesTheShareOfMeasuredPlusFallbacks', () => {
    const s = fallbackSummary(report({ measured: 95, fallbacks: [{ reason: 'TIMEOUT', count: 3 }, { reason: 'QUOTA', count: 2 }] }), '—')
    expect(s.total).toBe(5)
    expect(s.share).toBe('5%')
    expect(s.high).toBe(true)
  })

  it('fallbackSummary_atExactlyTwoPercent_isNotHigh_andJustOverIs', () => {
    expect(fallbackSummary(report({ measured: 98, fallbacks: [{ reason: 'TIMEOUT', count: 2 }] }), '—').high).toBe(false)
    expect(fallbackSummary(report({ measured: 97, fallbacks: [{ reason: 'TIMEOUT', count: 3 }] }), '—').high).toBe(true)
  })

  it('fallbackSummary_withNoFallbacks_isZeroAndCalm', () => {
    expect(fallbackSummary(report({ measured: 40 }), '—')).toEqual({ total: 0, share: '0%', high: false })
  })

  it('fallbackSummary_ofAnEmptyRange_isADashAndNeverDividesByZero', () => {
    expect(fallbackSummary(report(), '—')).toEqual({ total: 0, share: '—', high: false })
  })

  it('fallbackSummary_withOnlyFallbacks_isAllOfIt_andHigh', () => {
    expect(fallbackSummary(report({ fallbacks: [{ reason: 'KEY', count: 4 }] }), '—')).toEqual({ total: 4, share: '100%', high: true })
  })
})

describe('fallbackReason', () => {
  it('fallbackReason_eachKnownCode_mapsToItsWordsAndHint', () => {
    for (const code of KNOWN_FALLBACK_REASONS)
      expect(fallbackReason(code)).toEqual({ known: true, code, labelKey: `roadShadow.reasons.${code}.label`, hintKey: `roadShadow.reasons.${code}.hint` })
  })

  it('fallbackReason_matchesWhateverTheCase_asTheDoorGroupsIt', () => {
    expect(fallbackReason(' timeout ')).toMatchObject({ known: true, code: 'TIMEOUT' })
  })

  it('fallbackReason_anUnknownCode_staysRaw', () => {
    expect(fallbackReason('GEOCODE_MISS')).toEqual({ known: false, code: 'GEOCODE_MISS' })
    expect(fallbackReason('')).toEqual({ known: false, code: '' })
  })

  it('every known reason has words and a hint in both languages', () => {
    for (const code of KNOWN_FALLBACK_REASONS) {
      for (const locale of [en, ar]) {
        expect(typeof at(locale, `roadShadow.reasons.${code}.label`)).toBe('string')
        expect(typeof at(locale, `roadShadow.reasons.${code}.hint`)).toBe('string')
      }
    }
  })
})

describe('medianReading', () => {
  it('medianReading_aRatio_isTwoDecimals', () => {
    expect(medianReading(1.315)).toEqual({ ratio: '1.32' })
    expect(medianReading(1.3)).toEqual({ ratio: '1.30' })
    expect(medianReading(2)).toEqual({ ratio: '2.00' })
  })

  it('medianReading_null_readsNotEnoughMeasuredBids', () => {
    expect(medianReading(null)).toEqual({ noneKey: 'roadShadow.median.none' })
    expect(en.roadShadow.median.none).toBe('Not enough measured bids')
  })
})

describe('isEmptyRange', () => {
  it('isEmptyRange_isNothingMeasuredAndNoFallback', () => {
    expect(isEmptyRange(report())).toBe(true)
    expect(isEmptyRange(report({ measured: 1 }))).toBe(false)
    expect(isEmptyRange(report({ fallbacks: [{ reason: 'KEY', count: 1 }] }))).toBe(false)
  })
})

describe('the filters', () => {
  const now = new Date(2026, 10, 8, 23, 59)

  it('a bare URL is QC over the last 7 days ending today', () => {
    const f = shadowFiltersFromParams(new URLSearchParams(''))
    expect(f).toEqual({ from: '', to: '', type: DEFAULT_SHADOW_TYPE })
    expect(DEFAULT_SHADOW_TYPE).toBe('QC')
    expect(resolveShadowRange(f, now)).toEqual({ ok: true, from: '2026-11-02', to: '2026-11-08' })
    expect(shadowWire(f, { from: '2026-11-02', to: '2026-11-08' })).toEqual({ from: '2026-11-02', to: '2026-11-08', type: 'QC' })
  })

  it('the defaults write nothing to the URL', () => {
    expect(shadowFiltersToParams({ from: '', to: '', type: 'QC' }).toString()).toBe('')
  })

  it('All types is a present-but-blank type, kept through the URL and sent as blank', () => {
    const qs = shadowFiltersToParams({ from: '', to: '', type: '' })
    expect(qs.toString()).toBe('type=')
    const back = shadowFiltersFromParams(new URLSearchParams(qs.toString()))
    expect(back.type).toBe('')
    expect(shadowWire(back, { from: 'a', to: 'b' }).type).toBe('')
  })

  it('a picked range and another type round-trip through the URL', () => {
    const f = { from: '2026-10-01', to: '2026-10-31', type: 'NOR' }
    expect(shadowFiltersFromParams(shadowFiltersToParams(f))).toEqual(f)
    expect(resolveShadowRange(f, now)).toEqual({ ok: true, from: '2026-10-01', to: '2026-10-31' })
  })

  it('a half-typed range makes no call, but a reversed or long one goes to the door, which refuses it in its own words', () => {
    expect(resolveShadowRange({ from: '2026-10-01', to: '' }, now)).toEqual({ ok: false })
    expect(resolveShadowRange({ from: '2026-02-30', to: '2026-03-02' }, now)).toEqual({ ok: false })
    expect(resolveShadowRange({ from: '2026-10-31', to: '2026-10-01' }, now)).toEqual({ ok: true, from: '2026-10-31', to: '2026-10-01' })
    expect(resolveShadowRange({ from: '2026-01-01', to: '2026-10-31' }, now)).toEqual({ ok: true, from: '2026-01-01', to: '2026-10-31' })
  })
})

describe('review of 859', () => {
  it('formatShare_aHalfOnTheDecimal_roundsUp_notToItsBinaryNeighbour', () => {
    expect(formatShare(29, 2000, '—')).toBe('1.5%')
    expect(formatShare(1, 8, '—')).toBe('12.5%')
  })

  it('fallbackSummary_justOverTwoPercentButShownAs2_doesNotWarn', () => {
    // 102 / 5100 = 2.0% exactly as shown; 103 / 5100 = 2.0196…% → shown 2%, still calm.
    expect(fallbackSummary(report({ measured: 4998, fallbacks: [{ reason: 'KEY', count: 102 }] }), '—')).toEqual({ total: 102, share: '2%', high: false })
    expect(fallbackSummary(report({ measured: 4997, fallbacks: [{ reason: 'KEY', count: 103 }] }), '—')).toEqual({ total: 103, share: '2%', high: false })
    expect(fallbackSummary(report({ measured: 4893, fallbacks: [{ reason: 'KEY', count: 107 }] }), '—')).toMatchObject({ share: '2.1%', high: true })
  })

  it('pickRangeEnd_aToBeforeTheShownFrom_keepsASevenDayWindow_neverReversed', () => {
    const shown = { from: '2026-11-02', to: '2026-11-08' }
    const blank = { from: '', to: '', type: 'QC' }
    expect(pickRangeEnd(blank, 'to', '2026-10-15', shown)).toEqual({ from: '2026-10-09', to: '2026-10-15', type: 'QC' })
    expect(pickRangeEnd(blank, 'to', '2026-11-05', shown)).toEqual({ from: '2026-11-02', to: '2026-11-05', type: 'QC' })
    expect(pickRangeEnd(blank, 'from', '2026-11-20', shown)).toEqual({ from: '2026-11-20', to: '2026-11-26', type: 'QC' })
    expect(pickRangeEnd(blank, 'from', '2026-10-01', shown)).toEqual({ from: '2026-10-01', to: '2026-11-08', type: 'QC' })
  })

  it('pickRangeEnd_withBothEndsPicked_changesOnlyTheOne', () => {
    const picked = { from: '2026-10-01', to: '2026-10-31', type: '' }
    expect(pickRangeEnd(picked, 'to', '2026-09-01', { from: '2026-10-01', to: '2026-10-31' })).toEqual({ ...picked, to: '2026-09-01' })
    expect(pickRangeEnd(picked, 'from', '', { from: '2026-10-01', to: '2026-10-31' })).toEqual({ ...picked, from: '' })
  })
})
