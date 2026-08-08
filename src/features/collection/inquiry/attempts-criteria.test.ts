import { describe, expect, it } from 'vitest'
import { GRID_LIMIT } from './cap'
import {
  buildAttemptsParams,
  isLandingQuery,
  landingCriteria,
  type AttemptsCriteria,
} from './attempts-criteria'

// Ticket 255's Collection Attempts criteria Proof: the reason code is dropped when
// empty, and the today-defaulted pair holds.
const TODAY = new Date(2026, 7, 8) // 2026-08-08, local parts (no UTC round-trip)

describe('landingCriteria', () => {
  it('defaults From AND To to today — the pair, not one end', () => {
    expect(landingCriteria(TODAY)).toEqual({
      fromDate: '2026-08-08',
      toDate: '2026-08-08',
      storeCode: '',
      collectorStaffId: '',
      reasonCode: '',
    })
  })

  it('is a local calendar day, so a Riyadh evening does not land on tomorrow', () => {
    expect(landingCriteria(new Date(2026, 0, 1, 23, 59)).fromDate).toBe('2026-01-01')
  })
})

describe('buildAttemptsParams', () => {
  it('sends the landing state as the today pair plus the system cap', () => {
    expect(buildAttemptsParams(landingCriteria(TODAY))).toEqual({
      FromDate: '2026-08-08',
      ToDate: '2026-08-08',
      Limit: GRID_LIMIT,
    })
  })

  it('drops the reason code when the box is empty — or only whitespace', () => {
    expect(buildAttemptsParams({ reasonCode: '' })).not.toHaveProperty('ReasonCode')
    expect(buildAttemptsParams({ reasonCode: '   ' })).not.toHaveProperty('ReasonCode')
  })

  it('carries a typed reason code under the endpoint’s own name', () => {
    expect(buildAttemptsParams({ reasonCode: ' STORE_CLOSED ' }).ReasonCode).toBe('STORE_CLOSED')
  })

  it('uses THIS endpoint’s spellings — StoreCode and CollectorStaffId, not the other screens’', () => {
    // CollectionAttemptInquiryOptions names them differently from
    // CollectionInquiryOptions. A parameter the binder does not recognise is
    // silently ignored, and the grid comes back unfiltered.
    const params = buildAttemptsParams({ storeCode: ' 1001 ', collectorStaffId: ' 4472 ' })
    expect(params).toEqual({
      StoreCode: '1001',
      CollectorStaffId: '4472',
      Limit: GRID_LIMIT,
    })
    expect(params).not.toHaveProperty('StoreId')
    expect(params).not.toHaveProperty('CollectorOperatorId')
  })

  it('drops empty filters rather than sending them as empty strings', () => {
    const params = buildAttemptsParams({
      fromDate: '2026-08-08',
      toDate: '2026-08-08',
      storeCode: '   ',
      collectorStaffId: '',
      reasonCode: '',
    })
    expect(params).toEqual({
      FromDate: '2026-08-08',
      ToDate: '2026-08-08',
      Limit: GRID_LIMIT,
    })
  })

  it('sends the dates as a PAIR or not at all — half-open is unbounded, not narrow', () => {
    const halfOpen = buildAttemptsParams({ fromDate: '2026-08-01', toDate: '' })
    expect(halfOpen).not.toHaveProperty('FromDate')
    expect(halfOpen).not.toHaveProperty('ToDate')
    const otherHalf = buildAttemptsParams({ fromDate: '', toDate: '2026-08-08' })
    expect(otherHalf).not.toHaveProperty('FromDate')
    expect(otherHalf).not.toHaveProperty('ToDate')
    // …and a reason typed alongside a broken pair still travels.
    expect(buildAttemptsParams({ toDate: '2026-08-08', reasonCode: 'OTHER' })).toEqual({
      ReasonCode: 'OTHER',
      Limit: GRID_LIMIT,
    })
  })

  it('never asks for the WPF’s 200 — the cap is a system cap and it is generous', () => {
    expect(buildAttemptsParams({}).Limit).toBe(2000)
  })

  it('is a pure function of the draft — the same draft builds the same query', () => {
    const draft: AttemptsCriteria = {
      fromDate: '2026-08-01',
      toDate: '2026-08-08',
      storeCode: '1001',
      collectorStaffId: '4472',
      reasonCode: 'OTHER',
    }
    expect(buildAttemptsParams(draft)).toEqual(buildAttemptsParams({ ...draft }))
  })
})

describe('a draft that has not been promoted', () => {
  it('a half-typed store code leaves the applied query untouched', () => {
    const applied = buildAttemptsParams(landingCriteria(TODAY))
    expect(applied).not.toEqual(
      buildAttemptsParams({ ...landingCriteria(TODAY), storeCode: '10' }),
    )
    expect(applied).toEqual({
      FromDate: '2026-08-08',
      ToDate: '2026-08-08',
      Limit: GRID_LIMIT,
    })
  })
})

describe('the "filtered" chip reads the ISSUED query, not the draft', () => {
  const applied = (criteria: Partial<AttemptsCriteria>) =>
    isLandingQuery(buildAttemptsParams(criteria), TODAY)

  it('the landing state is the landing query', () => {
    expect(applied(landingCriteria(TODAY))).toBe(true)
  })

  it('a searched reason code is not', () => {
    expect(applied({ ...landingCriteria(TODAY), reasonCode: 'OTHER' })).toBe(false)
  })

  it('a widened period is not either', () => {
    expect(applied({ ...landingCriteria(TODAY), fromDate: '2026-08-07' })).toBe(false)
  })

  it('a whitespace-only reason code never made it onto the wire, so it is', () => {
    expect(applied({ ...landingCriteria(TODAY), reasonCode: '  ' })).toBe(true)
  })

  it('a query missing the date pair entirely is not it', () => {
    expect(applied({})).toBe(false)
  })
})
