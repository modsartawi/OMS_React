import { describe, expect, it } from 'vitest'
import type { DeliverectTermsRow } from '@/core/models/deliverect'
import { dayBefore, money, parseTermsDraft, termsConflict, termsCurrency, termsDraftFrom, termsTimeline } from './terms-timeline'

/** A terms row exactly as the contract has it. */
const row = (termsId: string, validFrom: string, validTo: string | null, over: Partial<DeliverectTermsRow> = {}): DeliverectTermsRow => ({
  termsId,
  platformKey: 'JAHEZ',
  validFrom,
  validTo,
  customerDiscountPct: 6.5,
  commissionPct: 2.5,
  deliveryFee: 9,
  deliveryFeeThreshold: 55,
  currencyKey: 'SAR',
  ...over,
})

const ROWS = [row('c', '2026-11-01', null), row('a', '2026-01-01', '2026-06-30'), row('b', '2026-07-01', '2026-10-31')]

describe('termsTimeline', () => {
  it('sorts the rows by validFrom, oldest first', () => {
    expect(termsTimeline(ROWS).map((e) => e.row.termsId)).toEqual(['a', 'b', 'c'])
  })

  it('marks the open row (validTo null) as current, and only it', () => {
    expect(termsTimeline(ROWS).map((e) => e.current)).toEqual([false, false, true])
  })

  it('never reorders the input it was given', () => {
    const input = [...ROWS]
    termsTimeline(input)
    expect(input.map((r) => r.termsId)).toEqual(['c', 'a', 'b'])
  })

  it('an empty platform has an empty timeline', () => {
    expect(termsTimeline([])).toEqual([])
  })

  it('a null answer reads as no rows', () => {
    expect(termsTimeline(null)).toEqual([])
  })
})

describe('termsConflict — the client hint for DLV-00008', () => {
  const timeline = termsTimeline(ROWS)

  it('a date after the open row starts is fine: the new row closes the open one the day before', () => {
    expect(termsConflict(timeline, '2026-12-01')).toBeNull()
    expect(termsConflict(timeline, '2026-11-02')).toBeNull()
  })

  it('🚩 the open row’s own first day is inside it — closing it the day before would leave it empty', () => {
    expect(termsConflict(timeline, '2026-11-01')).toEqual({ kind: 'inside', row: ROWS[0] })
  })

  it('a date inside a closed row is flagged with that row, both ends included', () => {
    expect(termsConflict(timeline, '2026-07-01')).toEqual({ kind: 'inside', row: ROWS[2] })
    expect(termsConflict(timeline, '2026-08-15')).toEqual({ kind: 'inside', row: ROWS[2] })
    expect(termsConflict(timeline, '2026-10-31')).toEqual({ kind: 'inside', row: ROWS[2] })
    expect(termsConflict(timeline, '2026-01-01')).toEqual({ kind: 'inside', row: ROWS[1] })
  })

  it('a date before every row is flagged against the first row it would run into', () => {
    expect(termsConflict(timeline, '2025-12-31')).toEqual({ kind: 'before', row: ROWS[1] })
  })

  it('a date in a gap before a later row is flagged against that row', () => {
    const gappy = termsTimeline([row('a', '2026-01-01', '2026-06-30'), row('b', '2026-08-01', null)])
    expect(termsConflict(gappy, '2026-07-15')).toEqual({ kind: 'before', row: gappy[1].row })
  })

  it('the first terms of a platform conflict with nothing', () => {
    expect(termsConflict([], '2026-01-01')).toBeNull()
  })

  it('no date yet, or not a date, is no hint', () => {
    expect(termsConflict(timeline, '')).toBeNull()
    expect(termsConflict(timeline, '2026-13-45')).toBeNull()
  })
})

describe('dayBefore — the day the previous row closes on', () => {
  it('steps back across a month and a year end, and a leap day', () => {
    expect(dayBefore('2026-11-01')).toBe('2026-10-31')
    expect(dayBefore('2027-01-01')).toBe('2026-12-31')
    expect(dayBefore('2028-03-01')).toBe('2028-02-29')
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
  })

  it('a value that is not a date has no day before', () => {
    expect(dayBefore('')).toBeNull()
    expect(dayBefore('2026-02-30')).toBeNull()
    expect(dayBefore('01/11/2026')).toBeNull()
  })
})

describe('parseTermsDraft — the add-terms fields as typed', () => {
  const ok = { validFrom: '2026-12-01', customerDiscountPct: '6.5', commissionPct: '2.5', deliveryFee: '9', deliveryFeeThreshold: '55.000' }

  it('reads the fields into the POST body’s numbers, currency carried as given', () => {
    expect(parseTermsDraft(ok, 'SAR')).toEqual({
      value: { validFrom: '2026-12-01', customerDiscountPct: 6.5, commissionPct: 2.5, deliveryFee: 9, deliveryFeeThreshold: 55, currencyKey: 'SAR' },
      problems: {},
    })
  })

  it('trims, and takes zero', () => {
    expect(parseTermsDraft({ ...ok, deliveryFee: ' 0 ', customerDiscountPct: '0.000' }, 'SAR').value?.deliveryFee).toBe(0)
  })

  it('every field is required', () => {
    const r = parseTermsDraft({ validFrom: '', customerDiscountPct: '', commissionPct: ' ', deliveryFee: '', deliveryFeeThreshold: '' }, 'SAR')
    expect(r.value).toBeNull()
    expect(r.problems).toEqual({
      validFrom: 'required',
      customerDiscountPct: 'required',
      commissionPct: 'required',
      deliveryFee: 'required',
      deliveryFeeThreshold: 'required',
    })
  })

  it('a date must be a real yyyy-MM-dd day', () => {
    expect(parseTermsDraft({ ...ok, validFrom: '2026-02-30' }, 'SAR').problems).toEqual({ validFrom: 'date' })
  })

  it('a number is ASCII digits with at most three decimals, never negative, never a sign or an exponent', () => {
    for (const bad of ['-1', '1e2', '+3', 'abc', '1.2345', '1,5', '.', '١٢'])
      expect([bad, parseTermsDraft({ ...ok, deliveryFee: bad }, 'SAR').problems]).toEqual([bad, { deliveryFee: 'number' }])
  })

  it('a percentage is at most 100', () => {
    expect(parseTermsDraft({ ...ok, commissionPct: '100' }, 'SAR').problems).toEqual({})
    expect(parseTermsDraft({ ...ok, commissionPct: '100.001' }, 'SAR').problems).toEqual({ commissionPct: 'percent' })
  })
})

describe('termsDraftFrom — the add-terms fields start from the open row', () => {
  it('copies the open row’s numbers, money at 3 decimals, the date empty', () => {
    expect(termsDraftFrom(termsTimeline(ROWS))).toEqual({
      validFrom: '',
      customerDiscountPct: '6.5',
      commissionPct: '2.5',
      deliveryFee: '9.000',
      deliveryFeeThreshold: '55.000',
    })
  })

  it('a platform with no open row starts empty', () => {
    expect(termsDraftFrom([])).toEqual({ validFrom: '', customerDiscountPct: '', commissionPct: '', deliveryFee: '', deliveryFeeThreshold: '' })
    expect(termsDraftFrom(termsTimeline([row('a', '2026-01-01', '2026-06-30')])).commissionPct).toBe('')
  })

  it('🚩 a value the fields could not send back as it is starts empty — never rounded', () => {
    const odd = termsTimeline([row('c', '2026-11-01', null, { commissionPct: 12.3456, customerDiscountPct: 1e-7 })])
    expect(termsDraftFrom(odd)).toMatchObject({ commissionPct: '', customerDiscountPct: '' })
  })

  it('every prefilled draft parses', () => {
    expect(parseTermsDraft({ ...termsDraftFrom(termsTimeline(ROWS)), validFrom: '2026-12-01' }, 'SAR').problems).toEqual({})
  })
})

describe('termsCurrency and money', () => {
  it('a new row carries the open row’s currency, else the latest row’s, else SAR', () => {
    expect(termsCurrency(termsTimeline([row('a', '2026-01-01', null, { currencyKey: 'AED' })]))).toBe('AED')
    expect(termsCurrency(termsTimeline([row('a', '2026-01-01', '2026-02-01', { currencyKey: 'KWD' })]))).toBe('KWD')
    expect(termsCurrency([])).toBe('SAR')
  })

  it('money is 3 decimals beside its currency', () => {
    expect(money(9, 'SAR')).toBe('9.000 SAR')
    expect(money(0, 'SAR')).toBe('0.000 SAR')
  })
})
