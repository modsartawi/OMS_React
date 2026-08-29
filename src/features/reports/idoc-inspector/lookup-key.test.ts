import { describe, expect, it } from 'vitest'
import {
  buildLookupKey,
  landingCriteria,
  missingParts,
  type LookupCriteria,
} from './lookup-key'

// Ticket 296's lookup-parser Proof: the draft→key promotion, trimming, the LOCAL
// required-field refusal on BOTH halves, and Reset returning the landing state.
// Pure module only — the spec's client-test ruling, mirroring retail-invoice.

describe('the landing state', () => {
  it('opens with both fields empty — the screen cannot guess a transaction', () => {
    expect(landingCriteria()).toEqual({ store: '', trxNumber: '' })
  })

  it('🚩 builds NO key at all — nothing fires on mount', () => {
    expect(buildLookupKey(landingCriteria())).toBeNull()
  })

  it('is what Reset returns to — a fresh draft equals the landing one', () => {
    const first = landingCriteria()
    const second = landingCriteria()
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
  })
})

describe('the local required-field refusal', () => {
  it('🚩 refuses a blank STORE — unlike invoices, the store is not optional here', () => {
    // A transaction number is only unique per store on this rail, so a lookup
    // without one is not a wider search; it is not a question.
    expect(buildLookupKey({ store: '', trxNumber: '00114600051234' })).toBeNull()
  })

  it('refuses a blank transaction number', () => {
    expect(buildLookupKey({ store: 'S042', trxNumber: '' })).toBeNull()
  })

  it('refuses whitespace in either half — a spacebar is not a key', () => {
    expect(buildLookupKey({ store: '   ', trxNumber: '00114600051234' })).toBeNull()
    expect(buildLookupKey({ store: 'S042', trxNumber: '  ' })).toBeNull()
  })

  it('refuses an absent field, and an absent draft entirely', () => {
    expect(buildLookupKey({ store: 'S042' })).toBeNull()
    expect(buildLookupKey({})).toBeNull()
    expect(buildLookupKey()).toBeNull()
  })

  it('🔑 accepts both halves — so the server 400 branch is unreachable from here', () => {
    // A blank store or transaction number is a domain fault on the server (spec
    // 1386: "real failures on the transaction route are exactly two"). It stays
    // a defence; a client that reached it would be a bug, not a user error.
    expect(buildLookupKey({ store: 'S042', trxNumber: '00114600051234' })).not.toBeNull()
  })
})

describe('which half is missing', () => {
  it('names both when nothing has been typed', () => {
    expect(missingParts(landingCriteria())).toEqual({ store: true, trxNumber: true })
  })

  it('names exactly the empty one', () => {
    expect(missingParts({ store: 'S042', trxNumber: '' })).toEqual({
      store: false,
      trxNumber: true,
    })
    expect(missingParts({ store: '  ', trxNumber: '99' })).toEqual({
      store: true,
      trxNumber: false,
    })
  })

  it('agrees with the builder — a key exists exactly when nothing is missing', () => {
    // The two readings of one rule, pinned to each other: a draft the form marks
    // as complete must be one the builder will send, and vice versa.
    const drafts: Partial<LookupCriteria>[] = [
      {},
      { store: 'S042' },
      { trxNumber: '99' },
      { store: ' ', trxNumber: '99' },
      { store: 'S042', trxNumber: '99' },
    ]
    for (const draft of drafts) {
      const missing = missingParts(draft)
      const complete = !missing.store && !missing.trxNumber
      expect(buildLookupKey(draft) !== null).toBe(complete)
    }
  })
})

describe('the draft becomes a key', () => {
  it('carries both halves through', () => {
    expect(buildLookupKey({ store: 'S042', trxNumber: '00114600051234' })).toEqual({
      storeCode: 'S042',
      trxNumber: '00114600051234',
    })
  })

  it('trims what a user pasted', () => {
    expect(buildLookupKey({ store: ' S042 ', trxNumber: ' 00114600051234\n' })).toEqual({
      storeCode: 'S042',
      trxNumber: '00114600051234',
    })
  })

  it('sends nothing else — the entry point is one keyed lookup, not a search', () => {
    expect(Object.keys(buildLookupKey({ store: 'S042', trxNumber: '99' })!)).toEqual([
      'storeCode',
      'trxNumber',
    ])
  })
})

