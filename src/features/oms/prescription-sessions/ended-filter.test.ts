/**
 * Ticket 547 — the Ended tab's search as the URL holds it, the range checked before sending, and
 * the door asked (`GET PrescriptionSessionWeb/Ended?from&to&store&state`). Pure.
 */
import { describe, expect, it } from 'vitest'
import {
  ENDED_RANGE_DAYS,
  ENDED_STATES,
  defaultEndedFilter,
  endedFilterFromParams,
  endedFilterToParams,
  endedRangeProblem,
  endedRequest,
  type EndedFilter,
} from './ended-filter'

// Friday 2026-10-23, mid-afternoon local.
const TODAY = new Date(2026, 9, 23, 15, 30)
const url = (qs: string) => endedFilterFromParams(new URLSearchParams(qs), TODAY)
const full: EndedFilter = { from: '2026-09-01', to: '2026-09-30', store: 'P019', state: 'WRITTEN_OFF' }

describe('the default range', () => {
  it('is the last 7 days, today included', () => {
    expect(defaultEndedFilter(TODAY)).toEqual({ from: '2026-10-17', to: '2026-10-23', store: '', state: '' })
  })

  it('crosses a month end by the calendar', () => {
    expect(defaultEndedFilter(new Date(2026, 2, 3)).from).toBe('2026-02-25')
  })

  it('a bare tab address reads as the default range, every store, every end state', () => {
    expect(url('tab=ended')).toEqual(defaultEndedFilter(TODAY))
  })
})

describe('filter ↔ URL', () => {
  it('every filter round-trips, and the tab key is written back', () => {
    const qs = endedFilterToParams(full).toString()
    expect(qs).toBe('tab=ended&from=2026-09-01&to=2026-09-30&store=P019&state=WRITTEN_OFF')
    expect(url(qs)).toEqual(full)
  })

  it('empty store and state drop; the store is trimmed', () => {
    expect(endedFilterToParams({ ...full, store: ' P002 ', state: '' }).toString()).toBe(
      'tab=ended&from=2026-09-01&to=2026-09-30&store=P002',
    )
  })

  it('one bad end reads as the whole default range, never a mix of the URL and the default', () => {
    expect(url('tab=ended&from=2026-09-01&to=nope')).toEqual(defaultEndedFilter(TODAY))
    expect(url('tab=ended&from=2026-02-30&to=2026-09-30')).toEqual(defaultEndedFilter(TODAY))
    expect(url('tab=ended&to=2026-09-30')).toEqual(defaultEndedFilter(TODAY))
  })

  it('a state that is not an end state, or a date that is not a day, reads as the default', () => {
    expect(url('tab=ended&from=yesterday&to=2026-13-40&state=DISPENSED')).toEqual(defaultEndedFilter(TODAY))
  })

  it('offers exactly the end states the Ended door accepts (PrescriptionSessionStates.Final)', () => {
    expect(ENDED_STATES).toEqual(['CLOSED', 'ABANDONED', 'WRITTEN_OFF'])
  })

  it('INVOICED is not an end state the door accepts (it closes in the same act): PSES-00223', () => {
    expect(ENDED_STATES).not.toContain('INVOICED')
    expect(url('tab=ended&state=INVOICED').state).toBe('')
  })
})

describe('the range check, before sending', () => {
  it('the default range is fine', () => {
    expect(endedRangeProblem(defaultEndedFilter(TODAY))).toBeNull()
  })

  it('one day (from = to) is fine', () => {
    expect(endedRangeProblem({ ...full, from: '2026-10-01', to: '2026-10-01' })).toBeNull()
  })

  it('a reversed range is refused', () => {
    expect(endedRangeProblem({ ...full, from: '2026-10-10', to: '2026-10-09' })).toBe('reversed')
  })

  it('a missing end is refused', () => {
    expect(endedRangeProblem({ ...full, from: '' })).toBe('missing')
    expect(endedRangeProblem({ ...full, to: 'not-a-day' })).toBe('missing')
  })

  it('92 days, both ends counted, is the widest a read covers; 93 is refused', () => {
    expect(ENDED_RANGE_DAYS).toBe(92)
    // 2026-07-01 … 2026-09-30 is 92 calendar days.
    expect(endedRangeProblem({ ...full, from: '2026-07-01', to: '2026-09-30' })).toBeNull()
    expect(endedRangeProblem({ ...full, from: '2026-06-30', to: '2026-09-30' })).toBe('tooWide')
  })

  it('a pasted reversed range keeps its dates, so the refusal names what was asked', () => {
    expect(url('tab=ended&from=2026-10-10&to=2026-10-01')).toMatchObject({ from: '2026-10-10', to: '2026-10-01' })
  })
})

describe('the door', () => {
  it('asks Ended with the days and only the filters set', () => {
    expect(endedRequest(full)).toEqual({
      path: 'PrescriptionSessionWeb/Ended',
      params: { from: '2026-09-01', to: '2026-09-30', store: 'P019', state: 'WRITTEN_OFF' },
    })
    expect(endedRequest(defaultEndedFilter(TODAY))).toEqual({
      path: 'PrescriptionSessionWeb/Ended',
      params: { from: '2026-10-17', to: '2026-10-23' },
    })
  })
})
