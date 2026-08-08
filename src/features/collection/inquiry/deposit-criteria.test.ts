import { describe, expect, it } from 'vitest'
import { GRID_LIMIT } from './cap'
import {
  DEPOSIT_STATUSES,
  buildDepositsParams,
  isLandingQuery,
  landingCriteria,
  type DepositsCriteria,
} from './deposit-criteria'

// Ticket 256's criteria Proof. What is asserted is what the wire and the
// accountant can observe — the params object and which draft counts as the
// landing state — never how the builder reached it.
//
// Fixed "today" throughout: the module takes `now` as an argument precisely so
// this suite does not have to run at a particular time of day.
const TODAY = new Date(2026, 7, 8) // 2026-08-08, local parts (no UTC round-trip)

describe('landingCriteria', () => {
  it('defaults From AND To to today, with Status = All and nothing else set', () => {
    expect(landingCriteria(TODAY)).toEqual({
      fromDate: '2026-08-08',
      toDate: '2026-08-08',
      depositNumber: '',
      collectorOperatorId: '',
      bankCode: '',
      status: 'ALL',
    })
  })

  it('is a local calendar day, so a Riyadh evening does not land on tomorrow', () => {
    expect(landingCriteria(new Date(2026, 0, 1, 23, 59)).fromDate).toBe('2026-01-01')
  })

  it('offers exactly the WPF’s three states, All first', () => {
    expect([...DEPOSIT_STATUSES]).toEqual(['ALL', 'POSTED', 'VOID'])
  })
})

describe('the segmented Status control', () => {
  // The headline assertion of this ticket's criteria: ALL is the CLIENT's word
  // for "no filter". Sending it would compare `"All"` against a column holding
  // only 'POSTED'/'VOID', so the grid would go silently empty while the control
  // said the opposite — a screen lying about its own filter.
  it('All sends NOTHING — not Status=All, not even Status=', () => {
    const params = buildDepositsParams({ ...landingCriteria(TODAY), status: 'ALL' })
    expect(params).not.toHaveProperty('Status')
    expect(Object.values(params)).not.toContain('ALL')
    expect(Object.values(params)).not.toContain('All')
  })

  it('POSTED and VOID travel as the server’s own strings, spelled exactly', () => {
    expect(buildDepositsParams({ status: 'POSTED' }).Status).toBe('POSTED')
    expect(buildDepositsParams({ status: 'VOID' }).Status).toBe('VOID')
  })

  it('a missing status is All, not a crash and not a blank filter', () => {
    expect(buildDepositsParams({})).not.toHaveProperty('Status')
  })
})

describe('buildDepositsParams', () => {
  it('sends the landing state as the today pair plus the system cap, and nothing else', () => {
    expect(buildDepositsParams(landingCriteria(TODAY))).toEqual({
      FromDate: '2026-08-08',
      ToDate: '2026-08-08',
      Limit: GRID_LIMIT,
    })
  })

  it('drops the Bank when the box is empty — or only whitespace', () => {
    expect(buildDepositsParams({ bankCode: '' })).not.toHaveProperty('BankCode')
    expect(buildDepositsParams({ bankCode: '   ' })).not.toHaveProperty('BankCode')
  })

  it('carries a typed Bank under BankCode, trimmed', () => {
    expect(buildDepositsParams({ bankCode: ' ANB ' }).BankCode).toBe('ANB')
  })

  it('drops the Deposit No# when the box is empty — or only whitespace', () => {
    expect(buildDepositsParams({ depositNumber: '' })).not.toHaveProperty('DepositNumber')
    expect(buildDepositsParams({ depositNumber: '  ' })).not.toHaveProperty('DepositNumber')
  })

  it('carries a typed Deposit No# under DepositNumber — never under DepositId, which is the ULID', () => {
    const params = buildDepositsParams({ depositNumber: ' 5501 ' })
    expect(params.DepositNumber).toBe('5501')
    // Comparing a ULID column against "5501" would return nothing, silently —
    // worse than not filtering at all.
    expect(params).not.toHaveProperty('DepositId')
  })

  it('drops an empty collector rather than sending it as an empty string', () => {
    expect(buildDepositsParams({ collectorOperatorId: '  ' })).not.toHaveProperty(
      'CollectorOperatorId',
    )
    expect(buildDepositsParams({ collectorOperatorId: ' 4472 ' }).CollectorOperatorId).toBe('4472')
  })

  it('sends the dates as a PAIR or not at all — half-open is unbounded, not narrow', () => {
    const halfOpen = buildDepositsParams({ fromDate: '2026-08-01', toDate: '' })
    expect(halfOpen).not.toHaveProperty('FromDate')
    expect(halfOpen).not.toHaveProperty('ToDate')
    const otherHalf = buildDepositsParams({ fromDate: '', toDate: '2026-08-08' })
    expect(otherHalf).not.toHaveProperty('FromDate')
    expect(otherHalf).not.toHaveProperty('ToDate')
    // …and a bank typed alongside a broken pair still travels.
    expect(buildDepositsParams({ fromDate: '2026-08-01', bankCode: 'ANB' })).toEqual({
      BankCode: 'ANB',
      Limit: GRID_LIMIT,
    })
  })

  it('keeps the whole date pair when both ends are set', () => {
    expect(buildDepositsParams({ fromDate: '2026-08-01', toDate: '2026-08-08' })).toEqual({
      FromDate: '2026-08-01',
      ToDate: '2026-08-08',
      Limit: GRID_LIMIT,
    })
  })

  it('never asks for the WPF’s 200 — the cap is a system cap and it is generous', () => {
    expect(buildDepositsParams({}).Limit).toBe(2000)
  })

  it('carries all six filters at once when all six are set', () => {
    const draft: DepositsCriteria = {
      fromDate: '2026-08-01',
      toDate: '2026-08-08',
      depositNumber: '5501',
      collectorOperatorId: '4472',
      bankCode: 'ANB',
      status: 'VOID',
    }
    expect(buildDepositsParams(draft)).toEqual({
      FromDate: '2026-08-01',
      ToDate: '2026-08-08',
      DepositNumber: '5501',
      CollectorOperatorId: '4472',
      BankCode: 'ANB',
      Status: 'VOID',
      Limit: GRID_LIMIT,
    })
  })

  it('is a pure function of the draft — the same draft builds the same query', () => {
    const draft: DepositsCriteria = {
      fromDate: '2026-08-01',
      toDate: '2026-08-08',
      depositNumber: '5501',
      collectorOperatorId: '4472',
      bankCode: 'ANB',
      status: 'POSTED',
    }
    expect(buildDepositsParams(draft)).toEqual(buildDepositsParams({ ...draft }))
  })
})

describe('a draft that has not been promoted', () => {
  it('a half-typed deposit number leaves the applied query untouched', () => {
    const applied = buildDepositsParams(landingCriteria(TODAY))
    expect(applied).not.toEqual(
      buildDepositsParams({ ...landingCriteria(TODAY), depositNumber: '5' }),
    )
    expect(applied).toEqual({
      FromDate: '2026-08-08',
      ToDate: '2026-08-08',
      Limit: GRID_LIMIT,
    })
  })

  it('Search promoting that draft is what changes the query', () => {
    expect(buildDepositsParams({ ...landingCriteria(TODAY), depositNumber: '5501' })).toEqual({
      FromDate: '2026-08-08',
      ToDate: '2026-08-08',
      DepositNumber: '5501',
      Limit: GRID_LIMIT,
    })
  })
})

describe('the "filtered" chip reads the ISSUED query, not the draft', () => {
  const applied = (criteria: Partial<DepositsCriteria>) =>
    isLandingQuery(buildDepositsParams(criteria), TODAY)

  it('the landing state is the landing query', () => {
    expect(applied(landingCriteria(TODAY))).toBe(true)
  })

  it('a chosen status is not — this is what makes the segmented control re-query visibly', () => {
    expect(applied({ ...landingCriteria(TODAY), status: 'POSTED' })).toBe(false)
    expect(applied({ ...landingCriteria(TODAY), status: 'VOID' })).toBe(false)
  })

  it('a widened period, a searched number and a chosen bank are not either', () => {
    expect(applied({ ...landingCriteria(TODAY), fromDate: '2026-08-07' })).toBe(false)
    expect(applied({ ...landingCriteria(TODAY), depositNumber: '5501' })).toBe(false)
    expect(applied({ ...landingCriteria(TODAY), bankCode: 'ANB' })).toBe(false)
  })

  it('a whitespace-only bank never made it onto the wire, so it is', () => {
    expect(applied({ ...landingCriteria(TODAY), bankCode: '  ' })).toBe(true)
  })

  it('a query missing the date pair entirely is not it', () => {
    expect(applied({})).toBe(false)
  })
})
