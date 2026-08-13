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
      // Nothing picked — the estate. A caller the roster does not know, or a payload
      // that never arrived, opens exactly as this screen did before the control
      // existed (BackOffice 1167).
      servedBy: { kind: '', id: '' },
      status: 'ALL',
    })
  })

  // 🚩 Default-to-mine reaches THIS screen only for a caller it can scope: a
  // collector's own rounds are real rows, an accountant's are provably none. See
  // `served-by.test.ts` for the full ruling; this pins that the landing carries it.
  it('opens a collector on their own collections, and an accountant on the estate', () => {
    const collector = { defaultScope: { kind: 'MINE' as const, staffId: '7787', role: 'COLLECTOR', displayName: 'مصلح' } }
    const accountant = { defaultScope: { kind: 'MINE' as const, staffId: '4466', role: 'ACCOUNTANT', displayName: 'ضحى' } }

    expect(landingCriteria(TODAY, collector).servedBy).toEqual({ kind: 'MINE', id: '7787' })
    expect(buildAcrsParams(landingCriteria(TODAY, collector))).toMatchObject({
      ServedByKind: 'MINE',
      ServedById: '7787',
    })

    expect(landingCriteria(TODAY, accountant).servedBy).toEqual({ kind: '', id: '' })
    expect(buildAcrsParams(landingCriteria(TODAY, accountant))).not.toHaveProperty('ServedByKind')
  })

  // …and the chip is measured against the landing the screen ACTUALLY opened on,
  // scope and all — otherwise it would be lit on mount for every collector, over a
  // grid showing exactly what the screen chose to show them.
  it('does not call a scoped landing "filtered"', () => {
    const collector = { defaultScope: { kind: 'MINE' as const, staffId: '7787', role: 'COLLECTOR', displayName: 'مصلح' } }
    const landed = buildAcrsParams(landingCriteria(TODAY, collector))

    expect(isLandingQuery(landed, TODAY, collector)).toBe(true)
    // Against an UNSCOPED landing the very same query is filtered, which is what
    // makes the options argument load-bearing rather than decorative.
    expect(isLandingQuery(landed, TODAY)).toBe(false)
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

  // ⚠️ The free-text `collectorOperatorId` box was REPLACED by the shared *Served
  // by* combobox in BackOffice 1167 — same column, same predicate, one control. The
  // empty-box case it used to pin now belongs to `buildServedByParams`, and the
  // typed-id case is pinned in `served-by.test.ts` as *a typed id travels as the
  // COLLECTOR kind*. This screen no longer sends `CollectorOperatorId` at all.
  it('no longer sends CollectorOperatorId from the toolbar — Served by asks that question now', () => {
    expect(buildAcrsParams({ servedBy: { kind: 'COLLECTOR', id: '4472' } })).toEqual({
      ServedByKind: 'COLLECTOR',
      ServedById: '4472',
      Limit: GRID_LIMIT,
    })
    expect(buildAcrsParams({ servedBy: { kind: '', id: '' } })).not.toHaveProperty(
      'CollectorOperatorId',
    )
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
      servedBy: { kind: 'COLLECTOR', id: '4472' },
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
