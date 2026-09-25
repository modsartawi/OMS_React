import { describe, expect, it } from 'vitest'
import { daySpan, daySpanText } from './day-span'

// Ticket 316 (BackOffice 1993): the two multi-valued default columns — an ACR's
// Collection date and a deposit's Business date — read "min … max, or one date when
// they fall on the same day; blank when there is none".

const t = ((key: string, vars?: Record<string, unknown>) =>
  vars ? `${key}|${JSON.stringify(vars)}` : key) as never

describe('daySpan', () => {
  it('picks the earliest and latest DAY, whatever the order the values arrive in', () => {
    // The contract's own deposit: lines dated the 10th of September and the 20th of August.
    expect(daySpan(['2026-09-10T00:00:00', '2026-08-20T00:00:00'])).toEqual({
      from: '2026-08-20',
      to: '2026-09-10',
    })
  })

  it('reads the day part only — two times on one day are one day', () => {
    expect(daySpan(['2026-09-12T08:00:00', '2026-09-12T23:40:00'])).toEqual({
      from: '2026-09-12',
      to: '2026-09-12',
    })
  })

  it('skips absences rather than counting them as the earliest day', () => {
    expect(daySpan([null, '', '0001-01-01T00:00:00', '2026-09-05T10:15:00'])).toEqual({
      from: '2026-09-05',
      to: '2026-09-05',
    })
  })

  it('is null when there is no day at all — an idle ACR, a deposit with no lines', () => {
    expect(daySpan([null, null])).toBeNull()
    expect(daySpan([])).toBeNull()
  })
})

describe('daySpanText', () => {
  it('is ONE date when both ends fall on the same day', () => {
    expect(daySpanText(t, { from: '2026-09-12', to: '2026-09-12' })).toBe('2026-09-12')
  })

  it('is both ends, through t(), when they differ', () => {
    expect(daySpanText(t, { from: '2026-09-05', to: '2026-09-12' })).toBe(
      'grid.daySpan|{"from":"2026-09-05","to":"2026-09-12"}',
    )
  })

  it('is BLANK when there is no span — never "unknown", never a year-1 date', () => {
    expect(daySpanText(t, null)).toBe('')
  })
})
