import { describe, expect, it } from 'vitest'
import {
  COLLECTIONS_LIMIT,
  buildCollectionsParams,
  isLandingQuery,
  landingCriteria,
  type CollectionsCriteria,
} from './collections-criteria'
import type { AssignmentOptions } from './served-by'

// Ticket 254's criteria Proof. What is asserted is what the wire and the operator
// can observe — the params object, and which draft counts as the landing state —
// never how the builder reached it.
//
// Fixed "today" throughout: the module takes `now` as an argument precisely so
// this suite does not have to run at a particular time of day.
const TODAY = new Date(2026, 7, 8) // 2026-08-08, local parts (no UTC round-trip)

describe('landingCriteria', () => {
  it('defaults the COLLECTION range to today on both ends, and leaves the business range open', () => {
    expect(landingCriteria(TODAY)).toEqual({
      businessDateFrom: '',
      businessDateTo: '',
      collectionDateFrom: '2026-08-08',
      collectionDateTo: '2026-08-08',
      storeId: '',
      collectorOperatorId: '',
      servedBy: { kind: '', id: '' },
    })
  })

  it('is a local calendar day, so a Riyadh evening does not land on tomorrow', () => {
    expect(landingCriteria(new Date(2026, 0, 1, 23, 59)).collectionDateFrom).toBe('2026-01-01')
  })
})

describe('buildCollectionsParams', () => {
  it('sends the landing state as today’s collection range plus the system cap', () => {
    expect(buildCollectionsParams(landingCriteria(TODAY))).toEqual({
      CollectionDateFrom: '2026-08-08',
      CollectionDateTo: '2026-08-08',
      Limit: COLLECTIONS_LIMIT,
    })
  })

  it('drops empty filters rather than sending them as empty strings', () => {
    const params = buildCollectionsParams({
      businessDateFrom: '',
      businessDateTo: '  ',
      collectionDateFrom: '2026-08-08',
      collectionDateTo: '2026-08-08',
      storeId: '   ',
      collectorOperatorId: '',
    })
    expect(params).not.toHaveProperty('StoreId')
    expect(params).not.toHaveProperty('CollectorOperatorId')
    expect(params).not.toHaveProperty('BusinessDateFrom')
    expect(params).not.toHaveProperty('BusinessDateTo')
  })

  it('carries store and collector under the endpoint’s own PascalCase names', () => {
    expect(
      buildCollectionsParams({ storeId: ' 1001 ', collectorOperatorId: ' 4472 ' }),
    ).toEqual({
      StoreId: '1001',
      CollectorOperatorId: '4472',
      Limit: COLLECTIONS_LIMIT,
    })
  })

  it('never asks for the WPF’s 200 — the cap is a system cap and it is generous', () => {
    expect(buildCollectionsParams({}).Limit).toBe(2000)
  })

  it('is a pure function of the draft — the same draft builds the same query', () => {
    const draft: CollectionsCriteria = {
      businessDateFrom: '2026-07-28',
      businessDateTo: '2026-08-07',
      collectionDateFrom: '2026-08-01',
      collectionDateTo: '2026-08-08',
      storeId: '1001',
      collectorOperatorId: '',
      servedBy: { kind: 'ACCOUNTANT', id: '4466' },
    }
    expect(buildCollectionsParams(draft)).toEqual(buildCollectionsParams({ ...draft }))
  })
})

// Ticket 315 (BackOffice 1992) — the four-filter contract. Two ranges NAMED by what
// they mean, each end optional and inclusive by day on the server.
describe('the business and collection date ranges', () => {
  it('sends a business range under its own PascalCase names', () => {
    expect(
      buildCollectionsParams({ businessDateFrom: '2026-09-01', businessDateTo: '2026-09-10' }),
    ).toEqual({
      BusinessDateFrom: '2026-09-01',
      BusinessDateTo: '2026-09-10',
      Limit: COLLECTIONS_LIMIT,
    })
  })

  it('sends both ranges together — they AND on the server, neither clears the other', () => {
    // The contract's own example query, less the served-by pair.
    expect(
      buildCollectionsParams({
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
      Limit: COLLECTIONS_LIMIT,
    })
  })

  it('never sends the legacy FromDate/ToDate — the contract retires them for the web', () => {
    // 🚩 The door still honours them and ANDs them with CollectionDate*; sending both
    // would be one period spelt twice, and a stale one would silently intersect.
    const params = buildCollectionsParams(landingCriteria(TODAY))
    expect(params).not.toHaveProperty('FromDate')
    expect(params).not.toHaveProperty('ToDate')
  })

  it('sends either end ALONE — an open-ended range is the contract’s, not a broken pair', () => {
    expect(buildCollectionsParams({ businessDateFrom: '2026-09-01' })).toEqual({
      BusinessDateFrom: '2026-09-01',
      Limit: COLLECTIONS_LIMIT,
    })
    expect(buildCollectionsParams({ businessDateTo: '2026-09-10' })).toEqual({
      BusinessDateTo: '2026-09-10',
      Limit: COLLECTIONS_LIMIT,
    })
    expect(buildCollectionsParams({ collectionDateFrom: '2026-09-12', storeId: '1001' })).toEqual({
      CollectionDateFrom: '2026-09-12',
      StoreId: '1001',
      Limit: COLLECTIONS_LIMIT,
    })
  })

  it('may leave the collection range off entirely, to ask about sales days alone', () => {
    const params = buildCollectionsParams({
      ...landingCriteria(TODAY),
      businessDateFrom: '2026-09-01',
      businessDateTo: '2026-09-10',
      collectionDateFrom: '',
      collectionDateTo: '',
    })
    expect(params).toEqual({
      BusinessDateFrom: '2026-09-01',
      BusinessDateTo: '2026-09-10',
      Limit: COLLECTIONS_LIMIT,
    })
  })

  it('sends the day as typed — no time part, no widening to the next midnight', () => {
    // Inclusive-by-day is the SERVER's rule ([From 00:00, (To + 1 day) 00:00)); a
    // client that added a day or a 23:59:59 would widen it twice.
    const params = buildCollectionsParams({ collectionDateFrom: ' 2026-09-12 ', collectionDateTo: '2026-09-12' })
    expect(params.CollectionDateFrom).toBe('2026-09-12')
    expect(params.CollectionDateTo).toBe('2026-09-12')
  })

  it('passes a From later than its To through — the door matches nothing, honestly', () => {
    expect(
      buildCollectionsParams({ businessDateFrom: '2026-09-10', businessDateTo: '2026-09-01' }),
    ).toEqual({
      BusinessDateFrom: '2026-09-10',
      BusinessDateTo: '2026-09-01',
      Limit: COLLECTIONS_LIMIT,
    })
  })
})

describe('a draft that has not been promoted', () => {
  // The whole point of the split: editing the draft cannot change the query,
  // because the query is built from what Search passed, not from what the toolbar
  // currently holds. This suite stands in for that at the seam — the Page holds
  // the applied params in their own state, and the drive proves the wiring.
  it('a half-typed store leaves the applied query untouched', () => {
    const applied = buildCollectionsParams(landingCriteria(TODAY))
    const halfTyped: CollectionsCriteria = { ...landingCriteria(TODAY), storeId: '10' }
    expect(applied).not.toEqual(buildCollectionsParams(halfTyped))
    expect(applied).toEqual({
      CollectionDateFrom: '2026-08-08',
      CollectionDateTo: '2026-08-08',
      Limit: COLLECTIONS_LIMIT,
    })
  })

  it('Search promoting that draft is what changes the query', () => {
    expect(buildCollectionsParams({ ...landingCriteria(TODAY), storeId: '1001' })).toEqual({
      CollectionDateFrom: '2026-08-08',
      CollectionDateTo: '2026-08-08',
      StoreId: '1001',
      Limit: COLLECTIONS_LIMIT,
    })
  })
})

describe('Reset', () => {
  it('returns the landing state — today, everything else cleared', () => {
    expect(landingCriteria(TODAY)).toEqual({
      businessDateFrom: '',
      businessDateTo: '',
      collectionDateFrom: '2026-08-08',
      collectionDateTo: '2026-08-08',
      storeId: '',
      collectorOperatorId: '',
      servedBy: { kind: '', id: '' },
    })
    expect(isLandingQuery(buildCollectionsParams(landingCriteria(TODAY)), TODAY)).toBe(true)
  })
})

describe('the "filtered" chip reads the ISSUED query, not the draft', () => {
  const applied = (criteria: Partial<CollectionsCriteria>) =>
    isLandingQuery(buildCollectionsParams(criteria), TODAY)

  it('a widened period is not the landing query', () => {
    expect(applied({ ...landingCriteria(TODAY), collectionDateFrom: '2026-08-07' })).toBe(false)
  })

  it('a business range is not the landing query — it is a filter like any other', () => {
    expect(applied({ ...landingCriteria(TODAY), businessDateFrom: '2026-08-01' })).toBe(false)
  })

  it('a collection range cleared to nothing is not it either', () => {
    expect(
      applied({ ...landingCriteria(TODAY), collectionDateFrom: '', collectionDateTo: '' }),
    ).toBe(false)
  })

  it('a searched store is not the landing query', () => {
    expect(applied({ ...landingCriteria(TODAY), storeId: '1001' })).toBe(false)
  })

  it('a whitespace-only store never made it onto the wire, so it is', () => {
    expect(applied({ ...landingCriteria(TODAY), storeId: '  ' })).toBe(true)
  })

  it('a query missing the collection range entirely is not it either', () => {
    expect(applied({})).toBe(false)
  })
})

// BackOffice 1165 — `LandingChipAccountsForTheDefaultScope`.
//
// A finance user's screen opens ALREADY SCOPED to their own branches and their
// reports'. Everything the chip does then has to be measured against THAT landing
// rather than against an unscoped one — otherwise the chip is lit on mount over a
// grid showing precisely what the screen chose to show, and its ✕ (Reset) puts the
// same scope straight back.
describe('the landing chip accounts for the default scope', () => {
  // The caller is on the roster, so the door hands back a landing scope: the union
  // of their own branches and their one-level reports'.
  const SCOPED: Partial<AssignmentOptions> = {
    accountants: [{ staffId: '4466', displayName: 'ضحى' }],
    collectors: [],
    supervisors: [],
    defaultScope: { kind: 'MINE', staffId: '4466', displayName: 'ضحى' },
  }

  it('opens on the caller’s own scope, and sends it as an ordinary pick', () => {
    expect(landingCriteria(TODAY, SCOPED).servedBy).toEqual({ kind: 'MINE', id: '4466' })

    // 🚩 The scope reaches the door as the SAME pair any hand-made pick uses —
    // there is no hidden landing parameter, which is what keeps the toolbar's
    // displayed scope and the query's scope one thing.
    expect(buildCollectionsParams(landingCriteria(TODAY, SCOPED))).toEqual({
      CollectionDateFrom: '2026-08-08',
      CollectionDateTo: '2026-08-08',
      Limit: COLLECTIONS_LIMIT,
      ServedByKind: 'MINE',
      ServedById: '4466',
    })
  })

  it('reads a scoped landing query as UNFILTERED — the chip stays dark on mount', () => {
    const landing = buildCollectionsParams(landingCriteria(TODAY, SCOPED))
    expect(isLandingQuery(landing, TODAY, SCOPED)).toBe(true)

    // …and the same query IS filtered for a caller who has no default scope, which
    // is what proves the comparison moved with the caller rather than being widened
    // to ignore the pair.
    expect(isLandingQuery(landing, TODAY)).toBe(false)
  })

  it('counts WIDENING as filtered — including widening all the way to everyone', () => {
    const widened = buildCollectionsParams({
      ...landingCriteria(TODAY, SCOPED),
      servedBy: { kind: 'ACCOUNTANT', id: '6420' },
    })
    expect(isLandingQuery(widened, TODAY, SCOPED)).toBe(false)

    const everyone = buildCollectionsParams({
      ...landingCriteria(TODAY, SCOPED),
      servedBy: { kind: '', id: '' },
    })
    expect(isLandingQuery(everyone, TODAY, SCOPED)).toBe(false)
  })

  // The ~7,600 case: no roster row, no default scope, and the screen behaves
  // byte-for-byte as it did before this control existed.
  it('lands unfiltered for a caller the roster does not know', () => {
    const noRosterRow: Partial<AssignmentOptions> = {
      accountants: [],
      collectors: [],
      supervisors: [],
      defaultScope: null,
    }
    expect(landingCriteria(TODAY, noRosterRow).servedBy).toEqual({ kind: '', id: '' })
    expect(buildCollectionsParams(landingCriteria(TODAY, noRosterRow))).toEqual({
      CollectionDateFrom: '2026-08-08',
      CollectionDateTo: '2026-08-08',
      Limit: COLLECTIONS_LIMIT,
    })
  })
})

// BackOffice 1166 — the three filters on this one toolbar narrow TOGETHER.
//
// 🚩 The `AcrId` drill-down is the screen's own precedent for the opposite
// behaviour: an exact filter that clears everything else. It is deliberately NOT
// followed by the toolbar's own controls. A control that silently un-sets another
// one while the user is looking elsewhere is how a grid ends up showing rows the
// toolbar says it excluded — and the query object is where that would happen, so
// this is where it is pinned.
describe('no filter clears another', () => {
  // The landing dates, so a change to TODAY stays one edit — plus the toolbar's
  // other two filters, filled in.
  const base: CollectionsCriteria = {
    ...landingCriteria(TODAY),
    storeId: '1103',
    collectorOperatorId: '7787',
  }

  it('setting Served by leaves StoreId in the query untouched', () => {
    expect(
      buildCollectionsParams({ ...base, servedBy: { kind: 'ACCOUNTANT', id: '4466' } }),
    ).toEqual({
      CollectionDateFrom: '2026-08-08',
      CollectionDateTo: '2026-08-08',
      StoreId: '1103',
      CollectorOperatorId: '7787',
      ServedByKind: 'ACCOUNTANT',
      ServedById: '4466',
      Limit: COLLECTIONS_LIMIT,
    })
  })

  it('setting the store leaves the Served by pair untouched — and vice versa', () => {
    const scopedOnly = buildCollectionsParams({
      ...base,
      storeId: '',
      collectorOperatorId: '',
      servedBy: { kind: 'ACCOUNTANT', id: '4466' },
    })
    const withStore = buildCollectionsParams({
      ...base,
      collectorOperatorId: '',
      servedBy: { kind: 'ACCOUNTANT', id: '4466' },
    })

    // Adding the store ADDS a key. It does not remove the pair, and it does not
    // change what the pair says.
    expect(withStore).toEqual({ ...scopedOnly, StoreId: '1103' })
  })

  it('holds even for a contradictory pair — the empty grid is the honest answer', () => {
    // A store outside the selected person's branches. The client's job is to send
    // both filters and let the server return nothing; suppressing one of them here
    // would be the toolbar describing a query the door never ran.
    const contradiction = buildCollectionsParams({
      ...base,
      storeId: '9999',
      collectorOperatorId: '',
      servedBy: { kind: 'ACCOUNTANT', id: '4466' },
    })
    expect(contradiction).toEqual({
      CollectionDateFrom: '2026-08-08',
      CollectionDateTo: '2026-08-08',
      StoreId: '9999',
      ServedByKind: 'ACCOUNTANT',
      ServedById: '4466',
      Limit: COLLECTIONS_LIMIT,
    })

    // …and the grid above it is not the landing one, so the Filtered chip is lit
    // over the empty result rather than the screen looking like an ordinary quiet
    // day. Both filters applied, and the screen saying so.
    expect(isLandingQuery(contradiction, TODAY)).toBe(false)
  })

  it('"Collected by" and *Served by* are two independent keys on one query', () => {
    // The two people-filters. They are different questions — assigned to, versus
    // who actually turned up — so neither one may stand in for the other, and the
    // relabel (1166) is what stops them reading as duplicates on screen.
    const params = buildCollectionsParams({
      ...base,
      storeId: '',
      servedBy: { kind: 'COLLECTOR', id: '4454' },
    })
    expect(params.CollectorOperatorId).toBe('7787')
    expect(params.ServedById).toBe('4454')
  })
})

// The touched-row trap's inquiry-side cousin (BackOffice 1166): the toolbar owns a
// draft and this module owns the query, and only Search/Reset promote one to the
// other. The new control joins that split rather than being an exception to it.
describe('a half-chosen Served by does not fire', () => {
  it('picking a scope in the toolbar leaves the applied query untouched', () => {
    const applied = buildCollectionsParams(landingCriteria(TODAY))
    const halfChosen: CollectionsCriteria = {
      ...landingCriteria(TODAY),
      servedBy: { kind: 'ACCOUNTANT', id: '4466' },
    }

    // Exactly the shape of the half-typed store above: the draft has moved, the
    // applied query has not, and only Search closes the gap.
    expect(applied).not.toEqual(buildCollectionsParams(halfChosen))
    expect(applied).toEqual({
      CollectionDateFrom: '2026-08-08',
      CollectionDateTo: '2026-08-08',
      Limit: COLLECTIONS_LIMIT,
    })
    expect(buildCollectionsParams(halfChosen)).toEqual({
      CollectionDateFrom: '2026-08-08',
      CollectionDateTo: '2026-08-08',
      ServedByKind: 'ACCOUNTANT',
      ServedById: '4466',
      Limit: COLLECTIONS_LIMIT,
    })
  })

  it('a Kind with no id yet sends NEITHER key — a request the server would refuse', () => {
    // 🚩 The genuinely half-chosen state: a Kind and no person. The server answers
    // that combination with a 400, so the builder drops it rather than constructing
    // a request it knows will be refused — and the rest of the toolbar still
    // travels, because a mid-selection scope must not take the other filters down
    // with it.
    const params = buildCollectionsParams({
      ...landingCriteria(TODAY),
      storeId: '1103',
      collectorOperatorId: '',
      servedBy: { kind: 'ACCOUNTANT', id: '' },
    })
    expect(params).not.toHaveProperty('ServedByKind')
    expect(params).not.toHaveProperty('ServedById')
    expect(params.StoreId).toBe('1103')
  })
})
