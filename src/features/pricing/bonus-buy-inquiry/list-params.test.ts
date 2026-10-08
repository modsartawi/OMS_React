import { describe, expect, it } from 'vitest'
import { DEFAULT_CRITERIA, buildListParams, isDefaultCriteria, searchOverrides, type BbyListCriteria } from './list-params'

// The inquiry search's pure seam (ticket 443, spec 441): toolbar criteria → GET Bby/List
// query. "Active only" split into a status filter and valid today.
const criteria = (over: Partial<BbyListCriteria> = {}): BbyListCriteria => ({ ...DEFAULT_CRITERIA, ...over })

describe('buildListParams', () => {
  it('opens on Activated + valid today, the active bonus buys', () => {
    expect(buildListParams(DEFAULT_CRITERIA)).toEqual({ activeOnly: false, status: ['activated'], validToday: true })
    expect(buildListParams({})).toEqual(buildListParams(DEFAULT_CRITERIA))
  })

  it('sends several statuses, in one order whatever order they were picked in', () => {
    expect(buildListParams(criteria({ statuses: ['tested', 'planned'] }))).toEqual({
      activeOnly: false,
      status: ['planned', 'tested'],
      validToday: true,
    })
  })

  it('sends no status at all when none is chosen (every status)', () => {
    expect(buildListParams(criteria({ statuses: [] }))).toEqual({ activeOnly: false, validToday: true })
  })

  it('sends valid-today off as false', () => {
    expect(buildListParams(criteria({ validToday: false }))).toEqual({
      activeOnly: false,
      status: ['activated'],
      validToday: false,
    })
  })

  it('lets a number search reach any status and any window', () => {
    expect(buildListParams(criteria({ bbyNumber: ' 100234 ', statuses: ['planned'], validToday: true }))).toEqual({
      activeOnly: false,
      bbyNumber: '100234',
    })
  })

  it('still ANDs a number with any dates given (only status and valid today are dropped)', () => {
    expect(buildListParams(criteria({ bbyNumber: '100234', validFrom: '20260901', validTo: '20260930' }))).toEqual({
      activeOnly: false,
      bbyNumber: '100234',
      validFrom: '20260901',
      validTo: '20260930',
    })
  })

  it('replaces valid today with the date range, and keeps the status filter', () => {
    expect(buildListParams(criteria({ validFrom: '20261001', validTo: '20261031', statuses: ['planned'] }))).toEqual({
      activeOnly: false,
      status: ['planned'],
      validFrom: '20261001',
      validTo: '20261031',
    })
    expect(buildListParams(criteria({ validTo: '20261031' }))).toEqual({
      activeOnly: false,
      status: ['activated'],
      validTo: '20261031',
    })
  })

  it('never asks the server for its own active-only gate', () => {
    for (const c of [DEFAULT_CRITERIA, criteria({ bbyNumber: '1' }), criteria({ validFrom: '20260101' })])
      expect(buildListParams(c).activeOnly).toBe(false)
  })
})

describe('isDefaultCriteria', () => {
  it('is true only for Activated + valid today with no number and no dates', () => {
    expect(isDefaultCriteria(DEFAULT_CRITERIA)).toBe(true)
    expect(isDefaultCriteria(criteria({ statuses: ['planned'] }))).toBe(false)
    expect(isDefaultCriteria(criteria({ statuses: [] }))).toBe(false)
    expect(isDefaultCriteria(criteria({ statuses: ['activated', 'tested'] }))).toBe(false)
    expect(isDefaultCriteria(criteria({ validToday: false }))).toBe(false)
    expect(isDefaultCriteria(criteria({ bbyNumber: '100234' }))).toBe(false)
    expect(isDefaultCriteria(criteria({ validFrom: '20260101' }))).toBe(false)
  })

  it('ignores the order and repeats of the chosen statuses', () => {
    expect(isDefaultCriteria(criteria({ statuses: ['activated', 'activated'] }))).toBe(true)
  })

  it('ignores blank-only fields', () => {
    expect(isDefaultCriteria(criteria({ bbyNumber: '  ' }))).toBe(true)
  })
})

describe('searchOverrides', () => {
  it('names what a search ignores: a number, both; a date range, valid today only', () => {
    expect(searchOverrides(DEFAULT_CRITERIA)).toEqual({ status: false, validToday: false })
    expect(searchOverrides(criteria({ bbyNumber: '100234' }))).toEqual({ status: true, validToday: true })
    expect(searchOverrides(criteria({ validFrom: '20260101' }))).toEqual({ status: false, validToday: true })
    expect(searchOverrides(criteria({ bbyNumber: ' ' }))).toEqual({ status: false, validToday: false })
  })
})
