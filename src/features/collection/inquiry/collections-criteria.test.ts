import { describe, expect, it } from 'vitest'
import { collectionsParamsFor } from './acr-scope'
import {
  COLLECTIONS_LIMIT,
  COLLECTION_TYPE_FILTERS,
  buildCollectionsParams,
  isLandingQuery,
  landingCriteria,
  sameQuery,
  type CollectionsCriteria,
} from './collections-criteria'
import type { AssignmentOptions } from './served-by'

// Ticket 254's criteria Proof. What is asserted is what the wire and the operator
// can observe — the params object, and which draft counts as the landing state —
// never how the builder reached it.
//
// Spec 2423 (ticket 423, BackOffice 2424) moved the landing: no date is
// pre-filled, Served by keeps its "mine" default, and nothing is requested until
// Search.

/** The empty landing draft, written out — every box blank, no scope. */
const EMPTY: CollectionsCriteria = {
  businessDateFrom: '',
  businessDateTo: '',
  collectionDateFrom: '',
  collectionDateTo: '',
  storeId: '',
  collectorOperatorId: '',
  servedBy: { kind: '', id: '' },
  collectionTypes: [],
  hasSurplus: false,
  hasStolen: false,
  amountFrom: '',
  amountTo: '',
  profitCenter: '',
}

/** A caller on the roster: the door hands back their own scope as the landing. */
const MINE: Partial<AssignmentOptions> = {
  accountants: [{ staffId: '4466', displayName: 'ضحى' }],
  collectors: [],
  supervisors: [],
  defaultScope: { kind: 'MINE', staffId: '4466', displayName: 'ضحى' },
}

describe('landingCriteria', () => {
  it('landingCriteria has no dates and keeps servedBy', () => {
    // Every box empty — the 254..2423 today..today collection range is gone.
    expect(landingCriteria()).toEqual(EMPTY)
    // …and the owner's ruling: the date goes, the scope stays.
    expect(landingCriteria(MINE)).toEqual({ ...EMPTY, servedBy: { kind: 'MINE', id: '4466' } })
  })

  it('is the same draft whenever it is built — no clock is read', () => {
    expect(landingCriteria(MINE)).toEqual(landingCriteria(MINE))
  })
})

describe('no request is issued on landing', () => {
  // 🚩 The seam (no RTL in this repo): the Page's applied criteria start as `null`
  // and its `useQuery` is enabled on `collectionsParamsFor(...) !== null`. So the
  // landing's whole network cost is this function's answer for `null`.
  it('no request is issued on landing — nothing applied and no ?acr= is no query', () => {
    expect(collectionsParamsFor('', null)).toBeNull()
    expect(collectionsParamsFor(undefined, null)).toBeNull()
  })

  it('Search with every box empty is a real query — the newest rows under the cap', () => {
    expect(collectionsParamsFor('', landingCriteria())).toEqual({ Limit: COLLECTIONS_LIMIT })
    expect(collectionsParamsFor('', landingCriteria(MINE))).toEqual({
      Limit: COLLECTIONS_LIMIT,
      ServedByKind: 'MINE',
      ServedById: '4466',
    })
  })

  it('the ?acr= drill-down still loads at once — following the link IS the search', () => {
    expect(collectionsParamsFor('01J0ACR', null)).toEqual({ Limit: COLLECTIONS_LIMIT, AcrId: '01J0ACR' })
  })
})

describe('buildCollectionsParams', () => {
  it('sends the landing state as the system cap alone', () => {
    expect(buildCollectionsParams(landingCriteria())).toEqual({
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
      ...EMPTY,
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
    const params = buildCollectionsParams(landingCriteria())
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
      ...landingCriteria(),
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
    const applied = buildCollectionsParams(landingCriteria())
    const halfTyped: CollectionsCriteria = { ...landingCriteria(), storeId: '10' }
    expect(applied).not.toEqual(buildCollectionsParams(halfTyped))
    expect(applied).toEqual({
      Limit: COLLECTIONS_LIMIT,
    })
  })

  it('Search promoting that draft is what changes the query', () => {
    expect(buildCollectionsParams({ ...landingCriteria(), storeId: '1001' })).toEqual({
      StoreId: '1001',
      Limit: COLLECTIONS_LIMIT,
    })
  })
})

describe('Reset', () => {
  it('returns the landing draft — every box cleared, the default scope put back', () => {
    expect(landingCriteria()).toEqual(EMPTY)
    expect(landingCriteria(MINE).servedBy).toEqual({ kind: 'MINE', id: '4466' })
    // The Page also drops the applied criteria back to `null`, so Reset returns to
    // the un-searched landing and issues nothing (see "no request on landing").
    expect(collectionsParamsFor('', null)).toBeNull()
  })
})

describe('the "filtered" chip reads the ISSUED query, not the draft', () => {
  const applied = (criteria: Partial<CollectionsCriteria>) =>
    isLandingQuery(buildCollectionsParams(criteria))

  it('a widened period is not the landing query', () => {
    expect(applied({ ...landingCriteria(), collectionDateFrom: '2026-08-07' })).toBe(false)
  })

  it('a business range is not the landing query — it is a filter like any other', () => {
    expect(applied({ ...landingCriteria(), businessDateFrom: '2026-08-01' })).toBe(false)
  })

  it('a collection range of one day is not it — the landing has none', () => {
    expect(
      applied({ ...landingCriteria(), collectionDateFrom: '2026-08-08', collectionDateTo: '2026-08-08' }),
    ).toBe(false)
  })

  it('a searched store is not the landing query', () => {
    expect(applied({ ...landingCriteria(), storeId: '1001' })).toBe(false)
  })

  it('a whitespace-only store never made it onto the wire, so it is', () => {
    expect(applied({ ...landingCriteria(), storeId: '  ' })).toBe(true)
  })

  it('isLandingQuery recognises the new landing — the empty draft, Searched as it stands', () => {
    expect(applied(landingCriteria())).toBe(true)
    expect(applied({})).toBe(true)
    // The 254..2423 today landing is now a filter like any other.
    expect(applied({ collectionDateFrom: '2026-08-08', collectionDateTo: '2026-08-08' })).toBe(false)
  })

  it('each of 2424’s filters is not the landing query', () => {
    expect(applied({ ...landingCriteria(), collectionTypes: ['Short'] })).toBe(false)
    expect(applied({ ...landingCriteria(), hasSurplus: true })).toBe(false)
    expect(applied({ ...landingCriteria(), hasStolen: true })).toBe(false)
    expect(applied({ ...landingCriteria(), amountFrom: '1000' })).toBe(false)
    expect(applied({ ...landingCriteria(), amountTo: '500' })).toBe(false)
    expect(applied({ ...landingCriteria(), profitCenter: '019' })).toBe(false)
    // …and a blank one never reached the wire.
    expect(applied({ ...landingCriteria(), profitCenter: '  ', amountFrom: ' ' })).toBe(true)
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
    expect(landingCriteria(SCOPED).servedBy).toEqual({ kind: 'MINE', id: '4466' })

    // 🚩 The scope reaches the door as the SAME pair any hand-made pick uses —
    // there is no hidden landing parameter, which is what keeps the toolbar's
    // displayed scope and the query's scope one thing.
    expect(buildCollectionsParams(landingCriteria(SCOPED))).toEqual({
      Limit: COLLECTIONS_LIMIT,
      ServedByKind: 'MINE',
      ServedById: '4466',
    })
  })

  it('reads a scoped landing query as UNFILTERED — the chip stays dark on mount', () => {
    const landing = buildCollectionsParams(landingCriteria(SCOPED))
    expect(isLandingQuery(landing, SCOPED)).toBe(true)

    // …and the same query IS filtered for a caller who has no default scope, which
    // is what proves the comparison moved with the caller rather than being widened
    // to ignore the pair.
    expect(isLandingQuery(landing)).toBe(false)
  })

  it('counts WIDENING as filtered — including widening all the way to everyone', () => {
    const widened = buildCollectionsParams({
      ...landingCriteria(SCOPED),
      servedBy: { kind: 'ACCOUNTANT', id: '6420' },
    })
    expect(isLandingQuery(widened, SCOPED)).toBe(false)

    const everyone = buildCollectionsParams({
      ...landingCriteria(SCOPED),
      servedBy: { kind: '', id: '' },
    })
    expect(isLandingQuery(everyone, SCOPED)).toBe(false)
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
    expect(landingCriteria(noRosterRow).servedBy).toEqual({ kind: '', id: '' })
    expect(buildCollectionsParams(landingCriteria(noRosterRow))).toEqual({
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
    ...landingCriteria(),
    storeId: '1103',
    collectorOperatorId: '7787',
  }

  it('setting Served by leaves StoreId in the query untouched', () => {
    expect(
      buildCollectionsParams({ ...base, servedBy: { kind: 'ACCOUNTANT', id: '4466' } }),
    ).toEqual({
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
      StoreId: '9999',
      ServedByKind: 'ACCOUNTANT',
      ServedById: '4466',
      Limit: COLLECTIONS_LIMIT,
    })

    // …and the grid above it is not the landing one, so the Filtered chip is lit
    // over the empty result rather than the screen looking like an ordinary quiet
    // day. Both filters applied, and the screen saying so.
    expect(isLandingQuery(contradiction)).toBe(false)
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
    const applied = buildCollectionsParams(landingCriteria())
    const halfChosen: CollectionsCriteria = {
      ...landingCriteria(),
      servedBy: { kind: 'ACCOUNTANT', id: '4466' },
    }

    // Exactly the shape of the half-typed store above: the draft has moved, the
    // applied query has not, and only Search closes the gap.
    expect(applied).not.toEqual(buildCollectionsParams(halfChosen))
    expect(applied).toEqual({
      Limit: COLLECTIONS_LIMIT,
    })
    expect(buildCollectionsParams(halfChosen)).toEqual({
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
      ...landingCriteria(),
      storeId: '1103',
      collectorOperatorId: '',
      servedBy: { kind: 'ACCOUNTANT', id: '' },
    })
    expect(params).not.toHaveProperty('ServedByKind')
    expect(params).not.toHaveProperty('ServedById')
    expect(params.StoreId).toBe('1103')
  })
})

// Ticket 423 — BackOffice 2424's wire contract: `CollectionTypes` (repeated),
// `HasSurplus`, `HasStolen`, `AmountFrom`, `AmountTo`, `ProfitCenter`. PascalCase,
// bound onto `CollectionInquiryOptions`; an empty value is never sent.
describe('BackOffice 2424’s filters', () => {
  it('new filters map to PascalCase params and empties are dropped', () => {
    expect(
      buildCollectionsParams({
        ...landingCriteria(),
        collectionTypes: ['Regular', 'OutsideSystem'],
        hasSurplus: true,
        hasStolen: true,
        amountFrom: ' 1000 ',
        amountTo: '2500.50',
        profitCenter: ' 019 ',
      }),
    ).toEqual({
      Limit: COLLECTIONS_LIMIT,
      CollectionTypes: ['Regular', 'OutsideSystem'],
      HasSurplus: true,
      HasStolen: true,
      AmountFrom: '1000',
      AmountTo: '2500.50',
      ProfitCenter: '019',
    })

    // Every one of them empty: not one key on the wire — no `CollectionTypes=[]`,
    // no `HasSurplus=false`, no `AmountFrom=`.
    const empty = buildCollectionsParams({
      ...landingCriteria(),
      collectionTypes: [],
      hasSurplus: false,
      hasStolen: false,
      amountFrom: '  ',
      amountTo: '',
      profitCenter: ' ',
    })
    expect(empty).toEqual({ Limit: COLLECTIONS_LIMIT })
  })

  it('sends the base types in the toolbar’s order, whatever order they were ticked in', () => {
    expect(
      buildCollectionsParams({ collectionTypes: ['OutsideSystem', 'Short', 'Regular'] }).CollectionTypes,
    ).toEqual([...COLLECTION_TYPE_FILTERS])
  })

  it('a tick alone is a whole filter — "has Surplus" needs no base type', () => {
    expect(buildCollectionsParams({ hasSurplus: true })).toEqual({ Limit: COLLECTIONS_LIMIT, HasSurplus: true })
  })

  it('either amount end travels alone, and a From above its To goes to the door to refuse', () => {
    expect(buildCollectionsParams({ amountFrom: '1000' })).toEqual({ Limit: COLLECTIONS_LIMIT, AmountFrom: '1000' })
    expect(buildCollectionsParams({ amountTo: '500' })).toEqual({ Limit: COLLECTIONS_LIMIT, AmountTo: '500' })
    expect(buildCollectionsParams({ amountFrom: '900', amountTo: '100' })).toEqual({
      Limit: COLLECTIONS_LIMIT,
      AmountFrom: '900',
      AmountTo: '100',
    })
  })

  it('ANDs with the rest of the toolbar — no new filter clears another', () => {
    expect(
      buildCollectionsParams({
        ...landingCriteria(MINE),
        storeId: '1103',
        collectionTypes: ['Short'],
        profitCenter: 'PH-019',
      }),
    ).toEqual({
      Limit: COLLECTIONS_LIMIT,
      StoreId: '1103',
      CollectionTypes: ['Short'],
      ProfitCenter: 'PH-019',
      ServedByKind: 'MINE',
      ServedById: '4466',
    })
  })
})

describe('sameQuery — a repeated Search is told from a new one', () => {
  it('compares an array value element by element, not by reference', () => {
    const draft = { ...landingCriteria(), collectionTypes: ['Short' as const] }
    expect(sameQuery(buildCollectionsParams(draft), buildCollectionsParams({ ...draft }))).toBe(true)
    expect(
      sameQuery(buildCollectionsParams(draft), buildCollectionsParams({ ...draft, collectionTypes: ['Regular'] })),
    ).toBe(false)
    expect(sameQuery(buildCollectionsParams(draft), buildCollectionsParams({ ...draft, storeId: '1001' }))).toBe(false)
  })
})
