/**
 * oms 930 (BackOffice spec 4063, door 4075) — the Mini POS scorecard: the payback ratio coloured against the 1.0× and
 * 1.2× bars (3710 M10), the ratio's cost prorated to the counted days beside the full cost entered (owner ruling
 * 2026-11-20), the settling-in week shown as excluded (M12), the weekly flags (M15), and the 400 refusal shown.
 * Components are rendered as static markup through a real i18next instance (en and ar); the network is stubbed at the
 * `@/core/api` boundary.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'
import { permissionsOf } from '@/core/permissions'
import type { MiniPosScorecard, MiniPosScorecardInputs, MiniPosWeeklyPaidShare } from '@/core/models/mini-pos-scorecard'
import en from '@/locales/en/mini-pos-scorecard.json'
import ar from '@/locales/ar/mini-pos-scorecard.json'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { miniPosScorecardApi } = await import('./api')
const { canOpenMiniPosScorecard } = await import('./access')
const sc = await import('./scorecard')
const { MoneyTest, PaybackRatio, ScorecardFailureBanner, ScorecardNotes, TrialWindow, WeeklyView } = await import('./ScorecardViews')

const NS = 'mini-pos-scorecard'
const draw = (element: ReactElement, lng: 'en' | 'ar' = 'en') => {
  const i18n = i18next.createInstance()
  i18n.init({ lng, resources: { [lng]: { [NS]: lng === 'en' ? en : ar } }, ns: [NS], defaultNS: NS, initAsync: false, interpolation: { escapeValue: false } })
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, element))
}

const inputs = (over: Partial<MiniPosScorecardInputs> = {}): MiniPosScorecardInputs => ({
  trialFrom: '2027-01-24',
  trialTo: '2027-03-18',
  settlingInEnd: '2027-01-30',
  comparisonOffsetDays: 354,
  promoterCost: 54000,
  upliftFrom: '2027-01-31',
  upliftTo: '2027-03-18',
  lastYearFrom: '2026-02-11',
  lastYearTo: '2026-03-29',
  nonPharmacyCategories: ['A001', 'A002', 'A003', 'A005', 'A008'],
  ...over,
})

const money = (over: Partial<MiniPosScorecard['money']> = {}): MiniPosScorecard['money'] => ({
  pharmacies: [
    { storeCode: 'R200', trialRole: 'Control', sales: 900, cost: 600, lastYearSales: 850, growth: 0.0588 },
    { storeCode: 'R101', trialRole: 'Trial', sales: 1500, cost: 900, lastYearSales: 1000, growth: 0.5 },
  ],
  trialSales: 1500,
  trialLastYearSales: 1000,
  trialGrowth: 0.5,
  controlSales: 900,
  controlLastYearSales: 850,
  controlGrowth: 0.0588,
  uplift: 0.4412,
  upliftSales: 441.2,
  trialMarginRate: 0.4,
  grossMarginOnUplift: 176.48,
  paybackRatio: 1.2,
  verdict: 'go',
  ...over,
})

const week = (storeCode: string, w: number, orders: number, paid: number, underHalf: boolean, pause: boolean): MiniPosWeeklyPaidShare => ({
  storeCode,
  week: w,
  weekFrom: `2027-0${w < 2 ? '1-24' : '1-31'}`,
  weekTo: '2027-02-06',
  orders,
  paid,
  share: orders ? paid / orders : null,
  underHalf,
  pause,
})

describe('the payback ratio against the 1.0× and 1.2× bars', () => {
  it.each([
    [0.8, 'no-go', 'bad'],
    [0.999, 'no-go', 'bad'],
    [1.0, 'panel', 'warn'],
    [1.19, 'panel', 'warn'],
    [1.2, 'go', 'ok'],
    [2.5, 'go', 'ok'],
    [null, 'none', 'mute'],
  ] as const)('%s → %s', (ratio, band, sev) => {
    expect(sc.ratioBand(ratio)).toBe(band)
    expect(sc.BAND_SEVERITY[sc.ratioBand(ratio)]).toBe(sev)
  })

  it.each([
    [0.8, 'no-go', 'bg-danger-050', 'bg-danger'],
    [1.0, 'panel', 'bg-attention-050', 'bg-attention'],
    [1.2, 'go', 'bg-success-050', 'bg-success'],
  ] as const)('draws %s coloured %s, with both bars on the meter', (ratio, band, tint, fill) => {
    const html = draw(createElement(PaybackRatio, { ratio, verdict: band }))
    expect(html).toContain(`data-minipos-ratio-band="${band}"`)
    expect(html).toContain(tint)
    expect(html).toContain(`rounded-full ${fill}"`)
    expect(html).toContain('data-minipos-bar="1.0"')
    expect(html).toContain('data-minipos-bar="1.2"')
    expect(html).toContain(sc.times(ratio))
  })

  it('places the bars on the meter where they stand, and the fill at the ratio', () => {
    expect(sc.meterGeometry(0.75)).toEqual({ fill: 50, noGo: 66.7, go: 80 })
    expect(sc.meterGeometry(3).fill).toBeCloseTo(90.9, 1)
  })

  it('shows the server verdict in words, and no meter without a ratio', () => {
    const html = draw(createElement(PaybackRatio, { ratio: null, verdict: 'no-cost' }))
    expect(html).toContain('data-minipos-ratio-band="none"')
    expect(html).toContain('No cost entered')
    expect(html).not.toContain('data-minipos-bar=')
    expect(draw(createElement(PaybackRatio, { ratio: 1.5, verdict: 'what' }))).toContain('No verdict')
  })
})

describe('the money test', () => {
  it('shows trial and control side by side, and the uplift in percentage points', () => {
    const html = draw(createElement(MoneyTest, { money: money(), inputs: inputs() }))
    expect(html).toContain('data-minipos-side="trial.sales"><bdi dir="ltr">1,500.00')
    expect(html).toContain('data-minipos-side="control.growth"><bdi dir="ltr">5.9%')
    expect(html).toContain('+44.1')
    expect(html.indexOf('data-minipos-pharmacy="R101"')).toBeLessThan(html.indexOf('data-minipos-pharmacy="R200"'))
  })

  it('labels the ratio cost as prorated to the counted days, beside the full cost entered (owner ruling 2026-11-20)', () => {
    const html = draw(
      createElement(MoneyTest, { money: money(), inputs: inputs({ countedPromoterCost: 47000, countedDays: 47, trialDays: 54 }) }),
    )
    expect(html).toContain('Cost for the counted days (prorated)')
    expect(html).toMatch(/data-minipos-money="countedCost".*47\/54.*47,000\.00/)
    expect(html).toMatch(/data-minipos-money="fullCost".*Full cost entered.*54,000\.00/)
  })

  it('never computes the prorated cost itself: absent from the answer, it reads as not sent', () => {
    const html = draw(createElement(MoneyTest, { money: money(), inputs: inputs() }))
    expect(html).toMatch(/data-minipos-money="countedCost".*Not sent by SIS\.Api/)
    expect(html).not.toContain('47,000')
    const none = draw(createElement(MoneyTest, { money: money({ paybackRatio: null, verdict: 'no-cost' }), inputs: inputs({ promoterCost: 0 }) }))
    expect(none).toMatch(/data-minipos-money="fullCost".*Not entered/)
  })

  it('states that money is SAR net of VAT and cost is today\'s master cost', () => {
    const html = draw(createElement(ScorecardNotes))
    expect(html).toContain('SAR, net of VAT')
    expect(html).toContain("today&#x27;s item master cost")
  })
})

describe('the settling-in week', () => {
  it('is shown as excluded from the uplift, and the counted window starts after it', () => {
    const html = draw(createElement(TrialWindow, { inputs: inputs() }))
    expect(html).toContain('data-minipos-settling-in="excluded"')
    expect(html).toContain('Settling-in week')
    expect(html).toContain('2027-01-24 – 2027-01-30')
    expect(html).toContain('Excluded from the uplift')
    expect(html).toContain('data-minipos-counted="2027-01-31..2027-03-18"')
  })

  it('is absent when the trial has none (null, blank, or before the trial)', () => {
    for (const settlingInEnd of [null, '', '2027-01-01']) {
      const html = draw(createElement(TrialWindow, { inputs: inputs({ settlingInEnd, upliftFrom: '2027-01-24' }) }))
      expect(html).toContain('data-minipos-settling-in="none"')
      expect(html).not.toContain('Excluded from the uplift')
    }
  })

  it('reads in Arabic too', () => {
    expect(draw(createElement(TrialWindow, { inputs: inputs() }), 'ar')).toContain('مستبعد من الزيادة')
  })
})

describe('the weekly view', () => {
  const offList = [
    { storeCode: 'R101', trxNumber: 'T1', trxDate: '2027-01-25T10:00:00', orderNo: 'O1', itemNumber: '100', aCode: 'A004', reason: 'category' },
    { storeCode: 'R102', trxNumber: 'T9', trxDate: '2027-02-02T11:00:00', orderNo: 'O9', itemNumber: '200', aCode: 'A001', reason: 'list' },
  ]

  it('numbers trial weeks from trialFrom, as the server does', () => {
    expect(sc.trialWeek('2027-01-24', '2027-01-24')).toBe(1)
    expect(sc.trialWeek('2027-01-24', '2027-01-30T23:59:00')).toBe(1)
    expect(sc.trialWeek('2027-01-24', '2027-01-31')).toBe(2)
    expect(sc.offListByWeek(offList, '2027-01-24').map((w) => w.week)).toEqual([2, 1])
  })

  it('highlights every off-list line as a compliance stop, by week', () => {
    const html = draw(createElement(WeeklyView, { weekly: { offListLines: offList, paidShare: [] }, trialFrom: '2027-01-24' }))
    expect(html).toContain('data-minipos-off-list="stop"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Compliance stop')
    expect(html).toContain('data-minipos-off-list-line="1|R101|100"')
    expect(html).toContain('data-minipos-off-list-line="2|R102|200"')
    expect(html).toContain('On the refusal list')
    expect(html).toContain('Category not allowed')
  })

  it('an empty list is the all-clear', () => {
    const html = draw(createElement(WeeklyView, { weekly: { offListLines: [], paidShare: [] }, trialFrom: '2027-01-24' }))
    expect(html).toContain('data-minipos-off-list="clear"')
    expect(html).not.toContain('Compliance stop')
  })

  it('flags under half and pause per pharmacy per week, and names the pharmacies to pause', () => {
    const rows = [
      week('R101', 1, 10, 4, true, false),
      week('R101', 2, 10, 3, true, true),
      week('R102', 1, 10, 4, true, false),
      week('R102', 2, 10, 8, false, false),
    ]
    const html = draw(createElement(WeeklyView, { weekly: { offListLines: [], paidShare: rows }, trialFrom: '2027-01-24' }))
    expect(html).toContain('data-minipos-week-cell="R101|1|underHalf"')
    expect(html).toContain('data-minipos-week-cell="R101|2|pause"')
    expect(html).toContain('data-minipos-week-cell="R102|2|ok"')
    expect(html).toContain('data-minipos-pause="R101"')
    expect(html).toContain('3 / 10')
    const grid = sc.weeklyGrid(rows)
    expect(grid.pharmacies.map((p) => [p.storeCode, p.pause])).toEqual([
      ['R101', true],
      ['R102', false],
    ])
    expect(sc.weekCellSeverity(rows[1])).toBe('bad')
    expect(sc.weekCellSeverity(rows[0])).toBe('warn')
    expect(sc.weekCellSeverity(rows[3])).toBe('ok')
  })

  it('leaves a week without orders empty and names no pause when none is due', () => {
    const rows = [week('R101', 1, 10, 6, false, false), week('R102', 2, 4, 1, true, false)]
    const grid = sc.weeklyGrid(rows)
    expect(grid.pharmacies[0].cells[1]).toBeNull()
    const html = draw(createElement(WeeklyView, { weekly: { offListLines: [], paidShare: rows }, trialFrom: '2027-01-24' }))
    expect(html).not.toContain('data-minipos-pause=')
  })
})

describe('a refused read', () => {
  const invalid = new ApiError('business', 'trialTo is before trialFrom', 400, [
    { errorCode: 'MINIPOS_SCORECARD_INVALID', internalErrorCode: '', errorMessage: 'trialTo is before trialFrom' },
  ])

  it('shows the 400 MINIPOS_SCORECARD_INVALID with the server sentence', () => {
    const failure = sc.scorecardFailure(invalid, 'fallback')
    expect(failure).toEqual({ kind: 'invalid', message: 'trialTo is before trialFrom', code: 'MINIPOS_SCORECARD_INVALID' })
    const html = draw(createElement(ScorecardFailureBanner, { failure }))
    expect(html).toContain('data-minipos-scorecard-failure="invalid"')
    expect(html).toContain('The scorecard refused these inputs')
    expect(html).toContain('trialTo is before trialFrom')
  })

  it('names the grant on a bare 403, and anything else as a failed read', () => {
    expect(sc.scorecardFailure(new ApiError('auth', 'x', 403), 'f').kind).toBe('denied')
    expect(sc.scorecardFailure(new ApiError('network', 'down', 0), 'f')).toMatchObject({ kind: 'failed', message: 'down' })
    expect(draw(createElement(ScorecardFailureBanner, { failure: { kind: 'denied', message: '', code: null } }))).toContain(
      'Mini POS scorecard grant',
    )
  })
})

describe('the call and the grant', () => {
  beforeEach(() => api.get.mockReset())

  it('sends only what the form holds, so the configured calendar answers for a blank', async () => {
    api.get.mockResolvedValue({})
    await miniPosScorecardApi.read(sc.draftToQuery({ ...sc.EMPTY_DRAFT, promoterCost: '54000' }))
    expect(api.get).toHaveBeenCalledWith('MiniPosScorecard', { promoterCost: 54000 })
    await miniPosScorecardApi.read(
      sc.draftToQuery({ trialFrom: '2027-01-24', trialTo: '2027-03-18', settlingInEnd: '2027-01-30', comparisonOffsetDays: '354', promoterCost: '' }),
    )
    expect(api.get).toHaveBeenLastCalledWith('MiniPosScorecard', {
      trialFrom: '2027-01-24',
      trialTo: '2027-03-18',
      settlingInEnd: '2027-01-30',
      comparisonOffsetDays: 354,
    })
  })

  it('opens on MiniPosScorecard:03 only', () => {
    expect(canOpenMiniPosScorecard(permissionsOf({ screens: ['MiniPosScorecard:03'] }))).toBe(true)
    expect(canOpenMiniPosScorecard(permissionsOf({ screens: ['MiniPosAdmin:03', 'MiniPosAdmin:06'] }))).toBe(false)
  })
})
