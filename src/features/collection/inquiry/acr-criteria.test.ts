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
  it('defaults the BUSINESS range to today on both ends, with Status = All', () => {
    expect(landingCriteria(TODAY)).toEqual({
      // Ticket 316: the ACR date is this screen's business date, and it is the
      // window the screen has always landed on — only its wire name moved.
      businessDateFrom: '2026-08-08',
      businessDateTo: '2026-08-08',
      collectionDateFrom: '',
      collectionDateTo: '',
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
    expect(landingCriteria(new Date(2026, 0, 1, 23, 59)).businessDateFrom).toBe('2026-01-01')
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
  it('sends the landing state as today’s business range plus the system cap, and nothing else', () => {
    expect(buildAcrsParams(landingCriteria(TODAY))).toEqual({
      BusinessDateFrom: '2026-08-08',
      BusinessDateTo: '2026-08-08',
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

  it('never asks for the WPF’s 200 — the cap is a system cap and it is generous', () => {
    expect(buildAcrsParams({}).Limit).toBe(2000)
  })

  it('is a pure function of the draft — the same draft builds the same query', () => {
    const draft: AcrsCriteria = {
      businessDateFrom: '2026-08-01',
      businessDateTo: '2026-08-08',
      collectionDateFrom: '2026-08-05',
      collectionDateTo: '2026-08-09',
      acrNumber: '41',
      servedBy: { kind: 'COLLECTOR', id: '4472' },
      status: 'CLOSED',
    }
    expect(buildAcrsParams(draft)).toEqual(buildAcrsParams({ ...draft }))
  })
})

// Ticket 316 (BackOffice 1993) — the four-filter contract on the ACR list. The
// business range reads the ACR date; the collection range reads ANY linked
// collection's collected-at. Each end optional, inclusive by day on the server.
describe('the business and collection date ranges', () => {
  it('sends both ranges under 1992’s PascalCase names — the contract’s own example', () => {
    expect(
      buildAcrsParams({
        businessDateFrom: '2026-09-01',
        businessDateTo: '2026-09-10',
        collectionDateFrom: '2026-09-12',
        collectionDateTo: '2026-09-12',
      }),
    ).toEqual({
      BusinessDateFrom: '2026-09-01',
      BusinessDateTo: '2026-09-10',
      CollectionDateFrom: '2026-09-12',
      CollectionDateTo: '2026-09-12',
      Limit: GRID_LIMIT,
    })
  })

  it('never sends the legacy FromDate/ToDate — the contract retires them for the web', () => {
    // 🚩 The door still honours them and INTERSECTS them with BusinessDate*; sending
    // both would be one window spelt twice, and a stale one would silently narrow.
    const params = buildAcrsParams({
      ...landingCriteria(TODAY),
      collectionDateFrom: '2026-08-01',
      collectionDateTo: '2026-08-08',
    })
    expect(params).not.toHaveProperty('FromDate')
    expect(params).not.toHaveProperty('ToDate')
  })

  it('sends either end ALONE — an open-ended range is the contract’s, not a broken pair', () => {
    expect(buildAcrsParams({ businessDateFrom: '2026-09-01' })).toEqual({
      BusinessDateFrom: '2026-09-01',
      Limit: GRID_LIMIT,
    })
    expect(buildAcrsParams({ collectionDateTo: '2026-09-12', status: 'OPEN' })).toEqual({
      CollectionDateTo: '2026-09-12',
      Status: 'OPEN',
      Limit: GRID_LIMIT,
    })
  })

  it('may leave the business range off entirely, to ask by collection day alone', () => {
    expect(
      buildAcrsParams({
        ...landingCriteria(TODAY),
        businessDateFrom: '',
        businessDateTo: ' ',
        collectionDateFrom: '2026-09-12',
        collectionDateTo: '2026-09-12',
      }),
    ).toEqual({
      CollectionDateFrom: '2026-09-12',
      CollectionDateTo: '2026-09-12',
      Limit: GRID_LIMIT,
    })
  })

  it('drops empty ends rather than sending them as empty strings', () => {
    const params = buildAcrsParams({
      businessDateFrom: '',
      businessDateTo: '   ',
      collectionDateFrom: '',
      collectionDateTo: '',
    })
    expect(params).toEqual({ Limit: GRID_LIMIT })
  })

  it('sends the day as typed — no time part, no widening to the next midnight', () => {
    const params = buildAcrsParams({ collectionDateFrom: ' 2026-09-12 ', collectionDateTo: '2026-09-12' })
    expect(params.CollectionDateFrom).toBe('2026-09-12')
    expect(params.CollectionDateTo).toBe('2026-09-12')
  })

  it('passes a From later than its To through — the door matches nothing, honestly', () => {
    expect(buildAcrsParams({ businessDateFrom: '2026-09-10', businessDateTo: '2026-09-01' })).toEqual({
      BusinessDateFrom: '2026-09-10',
      BusinessDateTo: '2026-09-01',
      Limit: GRID_LIMIT,
    })
  })

  it('ANDs the ranges with the ACR No#, the collector and the status — none clears another', () => {
    expect(
      buildAcrsParams({
        businessDateFrom: '2026-09-01',
        collectionDateTo: '2026-09-12',
        acrNumber: '1207',
        servedBy: { kind: 'COLLECTOR', id: 'COLL-9' },
        status: 'CLOSED',
      }),
    ).toEqual({
      BusinessDateFrom: '2026-09-01',
      CollectionDateTo: '2026-09-12',
      AcrNumber: '1207',
      ServedByKind: 'COLLECTOR',
      ServedById: 'COLL-9',
      Status: 'CLOSED',
      Limit: GRID_LIMIT,
    })
  })
})

describe('a draft that has not been promoted', () => {
  it('a half-typed ACR number leaves the applied query untouched', () => {
    const applied = buildAcrsParams(landingCriteria(TODAY))
    expect(applied).not.toEqual(
      buildAcrsParams({ ...landingCriteria(TODAY), acrNumber: '4' }),
    )
    expect(applied).toEqual({
      BusinessDateFrom: '2026-08-08',
      BusinessDateTo: '2026-08-08',
      Limit: GRID_LIMIT,
    })
  })

  it('Search promoting that draft is what changes the query', () => {
    expect(buildAcrsParams({ ...landingCriteria(TODAY), acrNumber: '41' })).toEqual({
      BusinessDateFrom: '2026-08-08',
      BusinessDateTo: '2026-08-08',
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
    expect(applied({ ...landingCriteria(TODAY), businessDateFrom: '2026-08-07' })).toBe(false)
    expect(applied({ ...landingCriteria(TODAY), acrNumber: '41' })).toBe(false)
  })

  it('a collection range is not the landing query — it is a filter like any other', () => {
    expect(applied({ ...landingCriteria(TODAY), collectionDateFrom: '2026-08-08' })).toBe(false)
  })

  it('a whitespace-only ACR number never made it onto the wire, so it is', () => {
    expect(applied({ ...landingCriteria(TODAY), acrNumber: '  ' })).toBe(true)
  })

  it('a query missing the business range entirely is not it', () => {
    expect(applied({})).toBe(false)
  })
})
