import { describe, expect, it } from 'vitest'
import { GRID_LIMIT } from './cap'
import {
  ACR_STATUSES,
  buildAcrsParams,
  isLandingQuery,
  landingCriteria,
  type AcrsCriteria,
} from './acr-criteria'

// Ticket 255's ACR criteria Proof. What is asserted is what the wire and the
// operator can observe — the params object and which draft counts as the landing
// state — never how the builder reached it.
//
// Fixed "today" throughout: the module takes `now` as an argument precisely so
// this suite does not have to run at a particular time of day.
const TODAY = new Date(2026, 7, 8) // 2026-08-08, local parts (no UTC round-trip)

describe('landingCriteria', () => {
  it('defaults From AND To to today, with Status = All', () => {
    expect(landingCriteria(TODAY)).toEqual({
      fromDate: '2026-08-08',
      toDate: '2026-08-08',
      acrNumber: '',
      collectorOperatorId: '',
      status: 'ALL',
    })
  })

  it('is a local calendar day, so a Riyadh evening does not land on tomorrow', () => {
    expect(landingCriteria(new Date(2026, 0, 1, 23, 59)).fromDate).toBe('2026-01-01')
  })

  it('offers exactly the WPF’s three states, All first', () => {
    expect([...ACR_STATUSES]).toEqual(['ALL', 'OPEN', 'CLOSED'])
  })
})

describe('the segmented Status control', () => {
  // The headline assertion of this ticket: ALL is the CLIENT's word for "no
  // filter". Sending it would compare `"All"` against a column holding only
  // 'OPEN'/'CLOSED', so the grid would go silently empty while the control said
  // the opposite — a screen lying about its own filter.
  it('All sends NOTHING — not Status=All, not even Status=', () => {
    const params = buildAcrsParams({ ...landingCriteria(TODAY), status: 'ALL' })
    expect(params).not.toHaveProperty('Status')
    expect(Object.values(params)).not.toContain('ALL')
    expect(Object.values(params)).not.toContain('All')
  })

  it('OPEN and CLOSED travel as the server’s own strings, spelled exactly', () => {
    expect(buildAcrsParams({ status: 'OPEN' }).Status).toBe('OPEN')
    expect(buildAcrsParams({ status: 'CLOSED' }).Status).toBe('CLOSED')
  })

  it('a missing status is All, not a crash and not a blank filter', () => {
    expect(buildAcrsParams({})).not.toHaveProperty('Status')
  })
})

describe('buildAcrsParams', () => {
  it('sends the landing state as the today pair plus the system cap, and nothing else', () => {
    expect(buildAcrsParams(landingCriteria(TODAY))).toEqual({
      FromDate: '2026-08-08',
      ToDate: '2026-08-08',
      Limit: GRID_LIMIT,
    })
  })

  it('drops the ACR No# when the box is empty — or only whitespace', () => {
    expect(buildAcrsParams({ acrNumber: '' })).not.toHaveProperty('AcrNumber')
    expect(buildAcrsParams({ acrNumber: '   ' })).not.toHaveProperty('AcrNumber')
  })

  it('carries a typed ACR No# under AcrNumber — never under AcrId, which is the ULID', () => {
    const params = buildAcrsParams({ acrNumber: ' 41 ' })
    expect(params.AcrNumber).toBe('41')
    // AcrId is 257's exact-row drill-down key. Comparing a ULID column against
    // "41" would return nothing, silently — worse than not filtering at all.
    expect(params).not.toHaveProperty('AcrId')
  })

  it('drops an empty collector rather than sending it as an empty string', () => {
    expect(buildAcrsParams({ collectorOperatorId: '  ' })).not.toHaveProperty(
      'CollectorOperatorId',
    )
    expect(buildAcrsParams({ collectorOperatorId: ' 4472 ' }).CollectorOperatorId).toBe('4472')
  })

  it('sends the dates as a PAIR or not at all — half-open is unbounded, not narrow', () => {
    const halfOpen = buildAcrsParams({ fromDate: '2026-08-01', toDate: '' })
    expect(halfOpen).not.toHaveProperty('FromDate')
    expect(halfOpen).not.toHaveProperty('ToDate')
    const otherHalf = buildAcrsParams({ fromDate: '', toDate: '2026-08-08' })
    expect(otherHalf).not.toHaveProperty('FromDate')
    expect(otherHalf).not.toHaveProperty('ToDate')
    // …and a status typed alongside a broken pair still travels.
    expect(buildAcrsParams({ fromDate: '2026-08-01', status: 'OPEN' })).toEqual({
      Status: 'OPEN',
      Limit: GRID_LIMIT,
    })
  })

  it('never asks for the WPF’s 200 — the cap is a system cap and it is generous', () => {
    expect(buildAcrsParams({}).Limit).toBe(2000)
  })

  it('is a pure function of the draft — the same draft builds the same query', () => {
    const draft: AcrsCriteria = {
      fromDate: '2026-08-01',
      toDate: '2026-08-08',
      acrNumber: '41',
      collectorOperatorId: '4472',
      status: 'CLOSED',
    }
    expect(buildAcrsParams(draft)).toEqual(buildAcrsParams({ ...draft }))
  })
})

describe('a draft that has not been promoted', () => {
  it('a half-typed ACR number leaves the applied query untouched', () => {
    const applied = buildAcrsParams(landingCriteria(TODAY))
    expect(applied).not.toEqual(
      buildAcrsParams({ ...landingCriteria(TODAY), acrNumber: '4' }),
    )
    expect(applied).toEqual({
      FromDate: '2026-08-08',
      ToDate: '2026-08-08',
      Limit: GRID_LIMIT,
    })
  })

  it('Search promoting that draft is what changes the query', () => {
    expect(buildAcrsParams({ ...landingCriteria(TODAY), acrNumber: '41' })).toEqual({
      FromDate: '2026-08-08',
      ToDate: '2026-08-08',
      AcrNumber: '41',
      Limit: GRID_LIMIT,
    })
  })
})

describe('the "filtered" chip reads the ISSUED query, not the draft', () => {
  const applied = (criteria: Partial<AcrsCriteria>) =>
    isLandingQuery(buildAcrsParams(criteria), TODAY)

  it('the landing state is the landing query', () => {
    expect(applied(landingCriteria(TODAY))).toBe(true)
  })

  it('a chosen status is not — this is what makes the segmented control re-query visibly', () => {
    expect(applied({ ...landingCriteria(TODAY), status: 'OPEN' })).toBe(false)
    expect(applied({ ...landingCriteria(TODAY), status: 'CLOSED' })).toBe(false)
  })

  it('a widened period and a searched ACR number are not either', () => {
    expect(applied({ ...landingCriteria(TODAY), fromDate: '2026-08-07' })).toBe(false)
    expect(applied({ ...landingCriteria(TODAY), acrNumber: '41' })).toBe(false)
  })

  it('a whitespace-only ACR number never made it onto the wire, so it is', () => {
    expect(applied({ ...landingCriteria(TODAY), acrNumber: '  ' })).toBe(true)
  })

  it('a query missing the date pair entirely is not it', () => {
    expect(applied({})).toBe(false)
  })
})
