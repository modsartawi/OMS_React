import { describe, expect, it } from 'vitest'
import { GRID_LIMIT } from './cap'
import {
  buildReadyParams,
  hidesReceipts,
  isLandingQuery,
  landingCriteria,
  type ReadyCriteria,
} from './ready-criteria'
import type { AssignmentOptions } from './served-by'

// Ticket 317's criteria Proof (BackOffice 1994's `## Web contract`): collector,
// accountant via Served-by, business date — PascalCase, every empty filter DROPPED.

const ROSTER: AssignmentOptions = {
  accountants: [{ staffId: '4466', displayName: 'ضحى' }],
  collectors: [{ staffId: 'COLL-9', displayName: 'فهد القحطاني' }],
  supervisors: [],
}
const ACCOUNTANT_ON_ROSTER: AssignmentOptions = {
  ...ROSTER,
  defaultScope: { kind: 'MINE', staffId: '4466', role: 'ACCOUNTANT', displayName: 'ضحى' },
}

describe('landingCriteria', () => {
  it('opens on everything still waiting — no business date, no collector — scoped to the caller’s own branches', () => {
    // The Done-when: "an accountant opens Ready for collection and sees every closed,
    // uncollected day and prepared receipt of THEIR stores".
    expect(landingCriteria(ACCOUNTANT_ON_ROSTER)).toEqual({
      businessDateFrom: '',
      businessDateTo: '',
      collectorId: '',
      servedBy: { kind: 'MINE', id: '4466' },
    })
  })

  it('a session on no roster row (a collector supervisor) lands on the estate — every collector visible', () => {
    expect(landingCriteria({ ...ROSTER, defaultScope: null }).servedBy).toEqual({ kind: '', id: '' })
    // …and so does a roster that has not arrived or could not be read.
    expect(landingCriteria(undefined).servedBy).toEqual({ kind: '', id: '' })
  })

  it('🚩 has no today in it — a list of what still waits has no period to default', () => {
    // A business-date bound would hide every prepared receipt (they have no business
    // day), so the landing must not set one.
    const landing = buildReadyParams(landingCriteria(ACCOUNTANT_ON_ROSTER))
    expect(landing).not.toHaveProperty('BusinessDateFrom')
    expect(landing).not.toHaveProperty('BusinessDateTo')
  })
})

describe('buildReadyParams', () => {
  it('sends the estate landing as the system cap alone', () => {
    expect(buildReadyParams(landingCriteria(undefined))).toEqual({ Limit: GRID_LIMIT })
  })

  it('sends the contract’s own example — the accountant filter through the Served-by pair', () => {
    // `GET CollectionWeb/Ready?ServedByKind=ACCOUNTANT&ServedById=4466&Limit=…`
    expect(buildReadyParams({ servedBy: { kind: 'ACCOUNTANT', id: '4466' } })).toEqual({
      ServedByKind: 'ACCOUNTANT',
      ServedById: '4466',
      Limit: GRID_LIMIT,
    })
  })

  it('uses THIS door’s spellings — CollectorId, not CollectorOperatorId or CollectorStaffId', () => {
    // A parameter the binder does not recognise is silently ignored, and the grid
    // comes back unfiltered.
    const params = buildReadyParams({ collectorId: ' COLL-9 ' })
    expect(params).toEqual({ CollectorId: 'COLL-9', Limit: GRID_LIMIT })
    expect(params).not.toHaveProperty('CollectorOperatorId')
    expect(params).not.toHaveProperty('CollectorStaffId')
  })

  it('sends the business range under 1992’s names, either end alone, the day as typed', () => {
    expect(buildReadyParams({ businessDateFrom: '2026-09-01', businessDateTo: '2026-09-20' })).toEqual({
      BusinessDateFrom: '2026-09-01',
      BusinessDateTo: '2026-09-20',
      Limit: GRID_LIMIT,
    })
    expect(buildReadyParams({ businessDateTo: ' 2026-09-20 ' })).toEqual({
      BusinessDateTo: '2026-09-20',
      Limit: GRID_LIMIT,
    })
  })

  it('🚩 drops every empty filter rather than sending it as an empty string', () => {
    const params = buildReadyParams({
      businessDateFrom: '',
      businessDateTo: '   ',
      collectorId: ' ',
      servedBy: { kind: '', id: '' },
    })
    expect(params).toEqual({ Limit: GRID_LIMIT })
    expect(Object.values(params)).not.toContain('')
  })

  it('sends no collection date — nothing on this list has been collected', () => {
    const params = buildReadyParams({ businessDateFrom: '2026-09-01' })
    expect(Object.keys(params).some((k) => k.startsWith('CollectionDate'))).toBe(false)
    expect(params).not.toHaveProperty('FromDate')
  })

  it('UNASSIGNED sends the Kind alone; a half-chosen pair sends neither key', () => {
    expect(buildReadyParams({ servedBy: { kind: 'UNASSIGNED', id: '' } })).toEqual({
      ServedByKind: 'UNASSIGNED',
      Limit: GRID_LIMIT,
    })
    const half = buildReadyParams({ servedBy: { kind: 'ACCOUNTANT', id: '' } })
    expect(half).not.toHaveProperty('ServedByKind')
    expect(half).not.toHaveProperty('ServedById')
  })

  it('ANDs the collector box with the Served-by pair — two questions, both sent', () => {
    expect(
      buildReadyParams({ collectorId: 'COLL-9', servedBy: { kind: 'ACCOUNTANT', id: '4466' } }),
    ).toEqual({ CollectorId: 'COLL-9', ServedByKind: 'ACCOUNTANT', ServedById: '4466', Limit: GRID_LIMIT })
  })
})

describe('hidesReceipts — the one thing a business date does that the reader cannot see', () => {
  it('is false with no business bound', () => {
    expect(hidesReceipts(buildReadyParams(landingCriteria(ACCOUNTANT_ON_ROSTER)))).toBe(false)
    expect(hidesReceipts(buildReadyParams({ collectorId: 'COLL-9' }))).toBe(false)
  })

  it('🚩 is true for EITHER end alone — any bound excludes every prepared receipt', () => {
    expect(hidesReceipts(buildReadyParams({ businessDateFrom: '2026-09-01' }))).toBe(true)
    expect(hidesReceipts(buildReadyParams({ businessDateTo: '2026-09-01' }))).toBe(true)
  })

  it('reads the ISSUED query — a blank box never made it onto the wire', () => {
    expect(hidesReceipts(buildReadyParams({ businessDateFrom: '  ' }))).toBe(false)
  })
})

describe('the "filtered" chip reads the ISSUED query, not the draft', () => {
  const applied = (criteria: Partial<ReadyCriteria>, options?: AssignmentOptions) =>
    isLandingQuery(buildReadyParams(criteria), options)

  it('the landing state is the landing query — scoped or not', () => {
    expect(applied(landingCriteria(ACCOUNTANT_ON_ROSTER), ACCOUNTANT_ON_ROSTER)).toBe(true)
    expect(applied(landingCriteria(undefined), undefined)).toBe(true)
  })

  it('widening an accountant to everyone is a filter off their landing', () => {
    expect(applied({ ...landingCriteria(ACCOUNTANT_ON_ROSTER), servedBy: { kind: '', id: '' } }, ACCOUNTANT_ON_ROSTER)).toBe(false)
  })

  it('a collector or a business bound is not the landing', () => {
    expect(applied({ ...landingCriteria(undefined), collectorId: 'COLL-9' })).toBe(false)
    expect(applied({ ...landingCriteria(undefined), businessDateTo: '2026-09-20' })).toBe(false)
  })

  it('a whitespace-only collector never made it onto the wire, so it is', () => {
    expect(applied({ ...landingCriteria(undefined), collectorId: '  ' })).toBe(true)
  })
})
