import { describe, expect, it } from 'vitest'
import { GRID_LIMIT } from './cap'
import {
  ACR_STATUSES,
  acrsParamsFor,
  buildAcrsParams,
  isLandingQuery,
  landingCriteria,
  sameQuery,
  type AcrsCriteria,
} from './acr-criteria'

// Ticket 255's ACR criteria Proof. What is asserted is what the wire and the
// operator can observe — the params object and which draft counts as the landing
// state — never how the builder reached it.

const COLLECTOR = {
  defaultScope: { kind: 'MINE' as const, staffId: '7787', role: 'COLLECTOR', displayName: 'مصلح' },
}
const ACCOUNTANT = {
  defaultScope: { kind: 'MINE' as const, staffId: '4466', role: 'ACCOUNTANT', displayName: 'ضحى' },
}

// 🚩 Spec 2423 (ticket 425): the screen opens BLANK. The 2026-09-27 today..today
// collection-date landing is gone, Served by keeps its default, and nothing is
// requested until Search — Cash Collections' 423 seam, copied.
describe('landingCriteria', () => {
  it('acr landing has no dates and issues no request', () => {
    expect(landingCriteria()).toEqual({
      businessDateFrom: '',
      businessDateTo: '',
      collectionDateFrom: '',
      collectionDateTo: '',
      acrNumber: '',
      // Nothing picked — the estate. A caller the roster does not know, or a payload
      // that never arrived, opens exactly as this screen did before the control
      // existed (BackOffice 1167).
      servedBy: { kind: '', id: '' },
      status: 'ALL',
      amountFrom: '',
      amountTo: '',
      profitCenter: '',
      collectorText: '',
    })

    // 🔑 No criteria applied is no query. The Page's `useQuery` is enabled on a
    // non-null answer, so the landing costs no request — whoever the caller is.
    expect(acrsParamsFor(null)).toBeNull()
    // …and a Search of that empty draft asks for the newest rows under the cap.
    expect(acrsParamsFor(landingCriteria())).toEqual({ Limit: GRID_LIMIT })
  })

  // 🚩 Default-to-mine reaches THIS screen only for a caller it can scope: a
  // collector's own rounds are real rows, an accountant's are provably none. Spec
  // 2423 makes ACCOUNTANT pickable on ACRs and does NOT make it their landing. See
  // `served-by.test.ts` for the full ruling; this pins that the landing carries it.
  it('opens a collector on their own collections, and an accountant on the estate', () => {
    expect(landingCriteria(COLLECTOR).servedBy).toEqual({ kind: 'MINE', id: '7787' })
    expect(acrsParamsFor(landingCriteria(COLLECTOR))).toEqual({
      ServedByKind: 'MINE',
      ServedById: '7787',
      Limit: GRID_LIMIT,
    })

    expect(landingCriteria(ACCOUNTANT).servedBy).toEqual({ kind: '', id: '' })
    expect(buildAcrsParams(landingCriteria(ACCOUNTANT))).not.toHaveProperty('ServedByKind')
  })

  // …and the chip is measured against the landing the screen ACTUALLY opened on,
  // scope and all — otherwise it would be lit on every collector's first Search,
  // over a grid showing exactly what the screen chose to show them.
  it('does not call a scoped landing "filtered"', () => {
    const landed = buildAcrsParams(landingCriteria(COLLECTOR))

    expect(isLandingQuery(landed, COLLECTOR)).toBe(true)
    // Against an UNSCOPED landing the very same query is filtered, which is what
    // makes the options argument load-bearing rather than decorative.
    expect(isLandingQuery(landed)).toBe(false)
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
    const params = buildAcrsParams({ ...landingCriteria(), status: 'ALL' })
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
  it('sends the empty landing as the system cap and nothing else — no date', () => {
    expect(buildAcrsParams(landingCriteria())).toEqual({ Limit: GRID_LIMIT })
  })

  it('drops the ACR No# when the box is empty — or only whitespace', () => {
    expect(buildAcrsParams({ acrNumber: '' })).not.toHaveProperty('AcrNo')
    expect(buildAcrsParams({ acrNumber: '   ' })).not.toHaveProperty('AcrNo')
  })

  it('carries a typed ACR No# under AcrNo — never under AcrNumber (an int on the server) nor AcrId, which is the ULID', () => {
    const params = buildAcrsParams({ acrNumber: ' 41 ' })
    expect(params.AcrNo).toBe('41')
    expect(params).not.toHaveProperty('AcrNumber')
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
      amountFrom: '1000',
      amountTo: '5000',
      profitCenter: '019',
      collectorText: 'faisal',
    }
    expect(buildAcrsParams(draft)).toEqual(buildAcrsParams({ ...draft }))
  })
})

// 🚩 Spec 2423 (ticket 425, BackOffice 2426/2428) — finance's ACR filters, PascalCase
// like the rest of this door, and the ACR No# as text.
describe('acr filters map to params; ACR No# is sent as text', () => {
  it('sends Amount, Profit center and Collector text under the contract’s names', () => {
    expect(
      buildAcrsParams({
        ...landingCriteria(),
        amountFrom: '1000',
        amountTo: '2500.50',
        profitCenter: '019',
        collectorText: 'Faisal',
      }),
    ).toEqual({
      AmountFrom: '1000',
      AmountTo: '2500.50',
      ProfitCenter: '019',
      CollectorText: 'Faisal',
      Limit: GRID_LIMIT,
    })
  })

  it('sends either Amount end alone, trimmed, and never an empty one', () => {
    expect(buildAcrsParams({ amountFrom: ' 1000 ', amountTo: '' })).toEqual({
      AmountFrom: '1000',
      Limit: GRID_LIMIT,
    })
    expect(buildAcrsParams({ amountFrom: '  ', amountTo: '500' })).toEqual({
      AmountTo: '500',
      Limit: GRID_LIMIT,
    })
  })

  it('never sends an empty Profit center or Collector text', () => {
    const params = buildAcrsParams({ profitCenter: '   ', collectorText: '' })
    expect(params).not.toHaveProperty('ProfitCenter')
    expect(params).not.toHaveProperty('CollectorText')
  })

  // ⚠️ A From above its To goes to the door, which refuses it with the inquiry's
  // criterion refusal — the client does not re-implement the server's rule.
  it('passes a From above its To through, for the server to refuse', () => {
    expect(buildAcrsParams({ amountFrom: '5000', amountTo: '1000' })).toEqual({
      AmountFrom: '5000',
      AmountTo: '1000',
      Limit: GRID_LIMIT,
    })
  })

  // 🔑 ADR 0066: the client never parses, validates or rebuilds the number. Every
  // form the server reads — full, month-and-number, bare, legacy — travels as typed.
  it('sends every form of the ACR number as typed, trimmed and nothing more', () => {
    for (const typed of ['6498-2610-0001', '2610-0001', '0001', '1834']) {
      expect(buildAcrsParams({ acrNumber: ` ${typed} ` }).AcrNo).toBe(typed)
    }
  })

  it('sends a malformed number too — refusing it is the server’s job', () => {
    expect(buildAcrsParams({ acrNumber: '6498/2610' }).AcrNo).toBe('6498/2610')
  })

  // The bare forms are narrowed by Collector or Served by on the server; this pins
  // only that all three reach it together and none clears another.
  it('ANDs Collector text with Served by and the ACR No# — none clears another', () => {
    expect(
      buildAcrsParams({
        acrNumber: '0001',
        collectorText: '6498',
        servedBy: { kind: 'ACCOUNTANT', id: '4466' },
      }),
    ).toEqual({
      AcrNo: '0001',
      CollectorText: '6498',
      ServedByKind: 'ACCOUNTANT',
      ServedById: '4466',
      Limit: GRID_LIMIT,
    })
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
      ...landingCriteria(),
      businessDateFrom: '2026-08-01',
      businessDateTo: '2026-08-08',
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
      AcrNo: '1207',
      ServedByKind: 'COLLECTOR',
      ServedById: 'COLL-9',
      Status: 'CLOSED',
      Limit: GRID_LIMIT,
    })
  })
})

describe('a draft that has not been promoted', () => {
  it('a half-typed ACR number leaves the applied query untouched', () => {
    const applied = buildAcrsParams(landingCriteria())
    expect(applied).not.toEqual(buildAcrsParams({ ...landingCriteria(), acrNumber: '4' }))
    expect(applied).toEqual({ Limit: GRID_LIMIT })
  })

  it('Search promoting that draft is what changes the query', () => {
    expect(buildAcrsParams({ ...landingCriteria(), acrNumber: '6498-2610-0001' })).toEqual({
      AcrNo: '6498-2610-0001',
      Limit: GRID_LIMIT,
    })
  })

  // The Page re-asks the door on a Search of an unchanged draft rather than letting
  // an identical query key swallow it — this is how it tells the two apart.
  it('tells a repeated Search from a new one', () => {
    const applied = buildAcrsParams({ ...landingCriteria(), amountFrom: '1000' })
    expect(sameQuery(buildAcrsParams({ ...landingCriteria(), amountFrom: ' 1000 ' }), applied)).toBe(true)
    expect(sameQuery(buildAcrsParams({ ...landingCriteria(), amountFrom: '1001' }), applied)).toBe(false)
    expect(sameQuery(buildAcrsParams(landingCriteria()), applied)).toBe(false)
  })
})

describe('the "filtered" chip reads the ISSUED query, not the draft', () => {
  const applied = (criteria: Partial<AcrsCriteria>) => isLandingQuery(buildAcrsParams(criteria))

  it('the empty landing, Searched as it stands, is the landing query', () => {
    expect(applied(landingCriteria())).toBe(true)
  })

  it('a chosen status is not — this is what makes the segmented control re-query visibly', () => {
    expect(applied({ ...landingCriteria(), status: 'OPEN' })).toBe(false)
    expect(applied({ ...landingCriteria(), status: 'CLOSED' })).toBe(false)
  })

  it('a period and a searched ACR number are not either', () => {
    expect(applied({ ...landingCriteria(), collectionDateFrom: '2026-08-07' })).toBe(false)
    expect(applied({ ...landingCriteria(), businessDateFrom: '2026-08-08' })).toBe(false)
    expect(applied({ ...landingCriteria(), acrNumber: '41' })).toBe(false)
  })

  it('each of 2426’s filters is a filter like any other', () => {
    expect(applied({ ...landingCriteria(), amountFrom: '1' })).toBe(false)
    expect(applied({ ...landingCriteria(), amountTo: '1' })).toBe(false)
    expect(applied({ ...landingCriteria(), profitCenter: '019' })).toBe(false)
    expect(applied({ ...landingCriteria(), collectorText: 'faisal' })).toBe(false)
  })

  it('a whitespace-only box never made it onto the wire, so it is', () => {
    expect(applied({ ...landingCriteria(), acrNumber: '  ', collectorText: ' ' })).toBe(true)
  })
})
