import { describe, expect, it } from 'vitest'
import {
  buildInvoiceSearchParams,
  landingCriteria,
  sameQuery,
  type InvoiceCriteria,
} from './invoice-criteria'

// Ticket 264's criteria Proof: the draft→query promotion, trimming, the dropped
// empty store code, the LOCAL required-field refusal, and Reset returning the
// landing state.

describe('the landing state', () => {
  it('opens with both fields empty — the screen cannot guess a number', () => {
    expect(landingCriteria()).toEqual({ trxNumber: '', storeCode: '' })
  })

  it('🚩 builds NO query at all — nothing fires on mount', () => {
    expect(buildInvoiceSearchParams(landingCriteria())).toBeNull()
  })

  it('is what Reset returns to — a fresh draft equals the landing one', () => {
    // Reset is `setCriteria(landingCriteria())` at the Page; what it must not be
    // is a remembered draft. Two calls returning equal-but-not-shared objects is
    // the property that makes that safe.
    const first = landingCriteria()
    const second = landingCriteria()
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
  })
})

describe('the local required-field refusal', () => {
  it('refuses a blank number', () => {
    expect(buildInvoiceSearchParams({ trxNumber: '', storeCode: '1001' })).toBeNull()
  })

  it('refuses whitespace — a spacebar is not a transaction number', () => {
    expect(buildInvoiceSearchParams({ trxNumber: '   ' })).toBeNull()
  })

  it('refuses an absent field, and an absent draft entirely', () => {
    expect(buildInvoiceSearchParams({})).toBeNull()
    expect(buildInvoiceSearchParams()).toBeNull()
  })

  it('🔑 accepts a number — so 400 TRX_NUMBER_REQUIRED is unreachable from here', () => {
    // The server keeps that arm as a defence; reaching it would be a client bug
    // (contract §4). Nothing this module can return sends a blank number.
    expect(buildInvoiceSearchParams({ trxNumber: '00114600051234' })).not.toBeNull()
  })
})

describe('the draft becomes a query', () => {
  it('sends the number alone when no store is named', () => {
    expect(buildInvoiceSearchParams({ trxNumber: '00114600051234' })).toEqual({
      trxNumber: '00114600051234',
    })
  })

  it('sends both when a store narrows it', () => {
    expect(buildInvoiceSearchParams({ trxNumber: '00114600051234', storeCode: 'P001' })).toEqual({
      trxNumber: '00114600051234',
      storeCode: 'P001',
    })
  })

  it('trims both — the endpoint matches exact, trimmed (contract §1)', () => {
    expect(
      buildInvoiceSearchParams({ trxNumber: '  00114600051234 ', storeCode: ' P001  ' }),
    ).toEqual({ trxNumber: '00114600051234', storeCode: 'P001' })
  })

  it('🚩 DROPS an empty store code — never sends storeCode=""', () => {
    const params = buildInvoiceSearchParams({ trxNumber: '00114600051234', storeCode: '' })
    expect(params).toEqual({ trxNumber: '00114600051234' })
    expect(params && 'storeCode' in params).toBe(false)
  })

  it('drops a whitespace-only store code the same way', () => {
    const params = buildInvoiceSearchParams({ trxNumber: '00114600051234', storeCode: '   ' })
    expect(params && 'storeCode' in params).toBe(false)
  })

  it('🚩 two spellings of the same draft build the SAME question', () => {
    // Which is what lets the Page re-ask it rather than be answered from cache:
    // a search that failed must be repeatable by pressing Search again.
    const typed = buildInvoiceSearchParams({ trxNumber: ' 00114600051234', storeCode: 'P001 ' })
    const retyped = buildInvoiceSearchParams({ trxNumber: '00114600051234', storeCode: 'P001' })
    expect(sameQuery(typed!, retyped!)).toBe(true)
  })

  it('a narrowed search is a DIFFERENT question from an unnarrowed one', () => {
    const wide = buildInvoiceSearchParams({ trxNumber: '00114600051234' })
    const narrow = buildInvoiceSearchParams({ trxNumber: '00114600051234', storeCode: 'P001' })
    expect(sameQuery(wide!, narrow!)).toBe(false)
    // …and not by accident of which side is compared: a missing key on either
    // side has to count.
    expect(sameQuery(narrow!, wide!)).toBe(false)
  })

  it('a different number is a different question', () => {
    expect(
      sameQuery(
        buildInvoiceSearchParams({ trxNumber: '00114600051234' })!,
        buildInvoiceSearchParams({ trxNumber: '00114600051235' })!,
      ),
    ).toBe(false)
  })

  it('sends the two contracted parameters and nothing else', () => {
    // ⚠️ No date window (the number encodes the date), no paging (the 50-row cap
    // is a tripwire, not a page size), and NO `Client` — RetailTrx's fourth key
    // part is a fixed '000' estate-wide and is not on this wire at all (§3).
    const criteria: InvoiceCriteria = { trxNumber: '00114600051234', storeCode: 'P001' }
    expect(Object.keys(buildInvoiceSearchParams(criteria) ?? {}).sort()).toEqual([
      'storeCode',
      'trxNumber',
    ])
  })
})
