import { describe, expect, it } from 'vitest'
import {
  buildLookupKey,
  criteriaForKey,
  keyFromSearchParams,
  landingCriteria,
  missingParts,
  reseedDraft,
  sameKeyOrNone,
  sameLookup,
  searchParamsForKey,
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

// ---- ticket 297: the re-ask rule ------------------------------------------
describe('asking the same question twice', () => {
  it('🚩 recognises an unchanged key, so the Page can RE-ASK instead of re-setting state', () => {
    // The query key IS the key object, so react-query answers an identical one
    // from cache — which after a failed lookup leaves a dead button under the
    // error banner. The Page reads this and calls `refetch()`.
    const first = buildLookupKey({ store: 'S042', trxNumber: '00114600051234' })
    const again = buildLookupKey({ store: 'S042', trxNumber: '00114600051234' })
    expect(first).not.toBeNull()
    expect(again).not.toBeNull()
    expect(sameLookup(first!, again!)).toBe(true)
  })

  it('compares the KEY, not the draft — surrounding space is the same question', () => {
    const typed = buildLookupKey({ store: '  S042 ', trxNumber: ' 00114600051234' })
    const clean = buildLookupKey({ store: 'S042', trxNumber: '00114600051234' })
    expect(sameLookup(typed!, clean!)).toBe(true)
  })

  it('a different store or a different number is a different question', () => {
    const base = { storeCode: 'S042', trxNumber: '00114600051234' }
    expect(sameLookup(base, { ...base, storeCode: 'S043' })).toBe(false)
    expect(sameLookup(base, { ...base, trxNumber: '00114600051235' })).toBe(false)
  })
})

// ---- ticket 462: the key in the URL ----------------------------------------
describe('the key a link carries', () => {
  const params = (qs: string) => new URLSearchParams(qs)

  it('🔑 both halves present gives a key', () => {
    expect(keyFromSearchParams(params('store=P001&trx=000123'))).toEqual({
      storeCode: 'P001',
      trxNumber: '000123',
    })
  })

  it('reads the SAP export console link as that console encodes it', () => {
    // `inspectorHref('P 1', 'a&b')` in the console writes exactly this string.
    expect(keyFromSearchParams(params('?store=P+1&trx=a%26b'))).toEqual({
      storeCode: 'P 1',
      trxNumber: 'a&b',
    })
  })

  it('🚩 either half missing gives NO key — an ordinary empty screen', () => {
    expect(keyFromSearchParams(params('store=P001'))).toBeNull()
    expect(keyFromSearchParams(params('trx=000123'))).toBeNull()
    expect(keyFromSearchParams(params(''))).toBeNull()
  })

  it('either half blank gives no key', () => {
    expect(keyFromSearchParams(params('store=&trx=000123'))).toBeNull()
    expect(keyFromSearchParams(params('store=P001&trx=%20%20'))).toBeNull()
  })

  it('trims both halves, the way Look up does', () => {
    expect(keyFromSearchParams(params('store=%20P001%20&trx=000123%20'))).toEqual({
      storeCode: 'P001',
      trxNumber: '000123',
    })
  })

  it('ignores any other parameter — the key is the whole question', () => {
    expect(keyFromSearchParams(params('store=P001&trx=1&day=2026-10-01'))).toEqual({
      storeCode: 'P001',
      trxNumber: '1',
    })
  })
})

describe('the key written back after a Look up', () => {
  it('writes the two names the link uses', () => {
    expect(searchParamsForKey({ storeCode: 'P001', trxNumber: '000123' }).toString()).toBe(
      'store=P001&trx=000123',
    )
  })

  it('writes nothing for no key — the landing address', () => {
    expect(searchParamsForKey(null).toString()).toBe('')
  })

  it('round-trips through the reader', () => {
    const key = { storeCode: 'P 1', trxNumber: 'a&b' }
    expect(keyFromSearchParams(searchParamsForKey(key))).toEqual(key)
  })

  it('fills the toolbar draft from a key, and the landing draft from none', () => {
    expect(criteriaForKey({ storeCode: 'P001', trxNumber: '000123' })).toEqual({
      store: 'P001',
      trxNumber: '000123',
    })
    expect(criteriaForKey(null)).toEqual(landingCriteria())
  })
})

describe('the draft follows the URL only when something else changed it', () => {
  const k1 = { storeCode: 'P001', trxNumber: '1' }

  it('🚩 keeps the draft when the URL arrives at the key a Look up wrote — its echo', () => {
    // Re-seeding would trim what the user typed.
    expect(reseedDraft(k1, { key: { storeCode: 'P001', trxNumber: '1' } })).toBeNull()
  })

  it('🚩 keeps a half-typed draft when the user’s own refused Look up cleared the key', () => {
    expect(reseedDraft(null, { key: null })).toBeNull()
  })

  it('follows a key from outside — Back, a pasted link', () => {
    expect(reseedDraft(k1, null)).toEqual({ store: 'P001', trxNumber: '1' })
    // A write still in flight for ANOTHER key does not make this one an echo.
    expect(reseedDraft(k1, { key: null })).toEqual({ store: 'P001', trxNumber: '1' })
  })

  it('🚩 returns to the landing draft when the key is cleared from outside — even over a half-typed draft', () => {
    // The menu leaf: nothing was written, so the stale half (and its refusal
    // marks) must not survive into the landing screen.
    expect(reseedDraft(null, null)).toEqual(landingCriteria())
    expect(reseedDraft(null, { key: k1 })).toEqual(landingCriteria())
  })
})

describe('the same key, or both none', () => {
  const k1 = { storeCode: 'P001', trxNumber: '1' }
  it('compares keys by value and treats two absences as the same', () => {
    expect(sameKeyOrNone(k1, { ...k1 })).toBe(true)
    expect(sameKeyOrNone(null, null)).toBe(true)
    expect(sameKeyOrNone(k1, null)).toBe(false)
    expect(sameKeyOrNone(null, k1)).toBe(false)
    expect(sameKeyOrNone(k1, { ...k1, trxNumber: '2' })).toBe(false)
  })
})
