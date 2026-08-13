import { describe, expect, it } from 'vitest'
import { landingCriteria, type CollectionsCriteria } from './collections-criteria'
import {
  ACR_SCOPE_PARAM,
  SCOPE_DISABLED_FIELDS,
  acrFormHref,
  buildAcrScopedParams,
  collectionsForAcrHref,
  collectionsParamsFor,
  isAcrScoped,
  readAcrScope,
  receiptHref,
  withoutAcrScope,
} from './acr-scope'

// Ticket 257's pure Proof — the seam where the four screens meet the two
// documents. Three claims, and the middle one is the whole ticket:
//
//   1. the three addresses are built here and nowhere else, and a blank id has no
//      address at all;
//   2. with `?acr=` set, the criteria sent carry `AcrId` and OMIT store, collector
//      and period entirely — because the server treats `AcrId` as an exclusive
//      filter and would discard them;
//   3. clearing the scope restores the ordinary today-defaulted query, and the
//      whole thing round-trips through the URL.
//
// No `new Date()` anywhere: today is passed in, so the landing state is testable
// rather than only observable.

const TODAY = new Date('2026-08-08T13:00:00Z')
const ACR = '01J0ACR00000000000000000001'

describe('the three addresses', () => {
  it('spells each route once, and encodes the id into it', () => {
    expect(receiptHref('01J0COLLECT0000000000000001')).toBe(
      '/collection/receipt/01J0COLLECT0000000000000001',
    )
    expect(acrFormHref(ACR)).toBe(`/collection/acr/${ACR}`)
    expect(collectionsForAcrHref(ACR)).toBe(`/collection/collections?acr=${ACR}`)
  })

  it('has NO address for a blank id, so a cell can draw nothing instead', () => {
    // `CollectionReceiptId` is a server change still in flight (BackOffice 1089):
    // an empty one is a real arrival, and `/collection/receipt/` is a 404 dressed
    // as a working action.
    for (const blank of ['', '   ', null, undefined]) {
      expect(receiptHref(blank)).toBeNull()
      expect(acrFormHref(blank)).toBeNull()
      expect(collectionsForAcrHref(blank)).toBeNull()
    }
  })

  it('escapes an id rather than pasting it raw into the URL', () => {
    expect(receiptHref('a b&c')).toBe('/collection/receipt/a%20b%26c')
    expect(collectionsForAcrHref('a b&c')).toBe('/collection/collections?acr=a%20b%26c')
  })
})

describe('the scope round-trips through the URL', () => {
  it('reads back exactly what the drill-down link wrote', () => {
    const query = collectionsForAcrHref(ACR)!.split('?')[1]
    expect(readAcrScope(query)).toBe(ACR)
    expect(isAcrScoped(readAcrScope(query))).toBe(true)
  })

  it('reads an id that needed escaping back as itself', () => {
    const query = collectionsForAcrHref('a b&c')!.split('?')[1]
    expect(readAcrScope(query)).toBe('a b&c')
  })

  it('an absent — or hand-emptied — param is NOT a scope', () => {
    expect(readAcrScope('')).toBe('')
    expect(readAcrScope('foo=1')).toBe('')
    // 🚩 `?acr=` with nothing after it reads as "not scoped", never as "the ACR
    // whose id is the empty string" — which would query the whole chain under a
    // chip claiming one ACR.
    expect(readAcrScope(`${ACR_SCOPE_PARAM}=`)).toBe('')
    expect(readAcrScope(`${ACR_SCOPE_PARAM}=%20%20`)).toBe('')
    expect(isAcrScoped(readAcrScope(`${ACR_SCOPE_PARAM}=`))).toBe(false)
  })

  it('clearing drops the scope and NOTHING else', () => {
    const cleared = withoutAcrScope(`${ACR_SCOPE_PARAM}=${ACR}&keep=me`)
    expect(cleared.get(ACR_SCOPE_PARAM)).toBeNull()
    expect(cleared.get('keep')).toBe('me')
    expect(readAcrScope(cleared)).toBe('')
  })

  it('leaves a URL that never had a scope alone', () => {
    expect(withoutAcrScope('keep=me').toString()).toBe('keep=me')
  })
})

describe('the four criteria the chip overrides and disables', () => {
  it('is From, To, Store, Collector and Served by — the toolbar’s whole set', () => {
    expect([...SCOPE_DISABLED_FIELDS]).toEqual([
      'fromDate',
      'toDate',
      'storeId',
      'collectorOperatorId',
      'servedBy',
    ])
  })

  it('names only fields the criteria really has', () => {
    const criteria = landingCriteria(TODAY)
    for (const field of SCOPE_DISABLED_FIELDS) expect(criteria).toHaveProperty(field)
  })

  it('disables every field the criteria has — nothing stays live', () => {
    // ⚠️ The honesty claim, stated as a set equality rather than a list: a fifth
    // filter added to the toolbar without being disabled here would be a live
    // input the server silently ignores, and this is the assertion that catches it.
    const criteria = landingCriteria(TODAY)
    expect([...SCOPE_DISABLED_FIELDS].sort()).toEqual(Object.keys(criteria).sort())
  })
})

describe('the query the scoped screen issues', () => {
  const FILTERED: CollectionsCriteria = {
    fromDate: '2026-07-01',
    toDate: '2026-07-31',
    storeId: '1003',
    collectorOperatorId: '4472',
    servedBy: { kind: 'ACCOUNTANT', id: '4466' },
  }

  it('carries the ACR and the system cap, and NOTHING else', () => {
    expect(buildAcrScopedParams(ACR)).toEqual({ Limit: 2000, AcrId: ACR })
  })

  it('OMITS store, collector and period entirely — the server ignores them', () => {
    // 🚩 The heart of the ticket. `AcrId` is an exclusive filter: sending a period
    // alongside it would not narrow anything, but it would leave a query string
    // that reads as a period filter to whoever debugs the door next.
    const params = collectionsParamsFor(ACR, FILTERED)
    expect(params).toEqual({ Limit: 2000, AcrId: ACR })
    for (const key of [
      'FromDate',
      'ToDate',
      'StoreId',
      'CollectorOperatorId',
      // The scope discards the assigned-to filter with the rest (BackOffice 1163):
      // the door ignores it under an AcrId exactly as it ignores the other four.
      'ServedByKind',
      'ServedById',
    ])
      expect(params).not.toHaveProperty(key)
  })

  it('trims the id rather than sending the URL’s whitespace to the door', () => {
    expect(collectionsParamsFor(`  ${ACR}  `, FILTERED)).toEqual({ Limit: 2000, AcrId: ACR })
  })

  it('is the ORDINARY criteria query when there is no scope', () => {
    expect(collectionsParamsFor('', FILTERED)).toEqual({
      Limit: 2000,
      FromDate: '2026-07-01',
      ToDate: '2026-07-31',
      StoreId: '1003',
      CollectorOperatorId: '4472',
      ServedByKind: 'ACCOUNTANT',
      ServedById: '4466',
    })
  })

  it('restores the today-defaulted landing query when the chip is cleared', () => {
    // The criteria are never mutated by the scope, so dropping the param restores
    // them intact — which is why "clearing returns the ordinary screen" is a
    // branch rather than an effect the Page has to remember to run.
    const landing = landingCriteria(TODAY)
    const scoped = collectionsParamsFor(ACR, landing)
    const cleared = collectionsParamsFor(readAcrScope(withoutAcrScope(`acr=${ACR}`)), landing)
    expect(scoped).toEqual({ Limit: 2000, AcrId: ACR })
    expect(cleared).toEqual({ Limit: 2000, FromDate: '2026-08-08', ToDate: '2026-08-08' })
  })
})
