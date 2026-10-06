import { describe, expect, it } from 'vitest'

import { LEDGER_PATH } from './addresses'
import {
  hasCriterion,
  LEDGER_STATUSES,
  ledgerKey,
  ledgerQuery,
  ledgerSearch,
  readCriteria,
  readLedgerAmount,
} from './ledger'

/**
 * `ledger.ts` — the cross-estate lookup's URL grammar and its one refusal.
 *
 * 🔑 The assertions worth having here are the ones a component test could not make
 * and a typecheck cannot see: that a hand-edited address DEGRADES rather than breaks,
 * that the empty question is recognised as empty, and that the builder always names
 * its own **path** (283) — the last of which is a real defect if it regresses,
 * because the ledger and the branch account share the `?store=` key.
 */

const params = (search: string) => new URLSearchParams(search)

describe('hasCriterion', () => {
  it('refuses the empty question', () => {
    expect(hasCriterion({})).toBe(false)
    // ⚠️ Not "undefined-ish": an empty string is what a bare `?store=` reads as, and
    // it must not count as asking about a branch whose code is ''.
    expect(hasCriterion({ storeId: '', batchId: '' })).toBe(false)
  })

  it('counts a status alone — breadth is not the thing being refused', () => {
    // 🔑 This is the ordinary estate-wide call and the whole reason the view exists.
    expect(hasCriterion({ status: 'OPEN' })).toBe(true)
  })

  it('counts an entry number, including one that would be falsy as a value', () => {
    expect(hasCriterion({ entryNumber: 143 })).toBe(true)
    // A `!criteria.entryNumber` guard would read entry 0 as "nothing asked". The
    // sequence starts at 1 so it cannot arrive, but the guard is written on
    // `!== undefined` so the rule does not depend on that staying true.
    expect(hasCriterion({ entryNumber: 0 })).toBe(true)
  })

  it('counts each criterion on its own', () => {
    expect(hasCriterion({ storeId: '0142' })).toBe(true)
    expect(hasCriterion({ entryKind: 'SHORTAGE' })).toBe(true)
    expect(hasCriterion({ batchId: '01J8' })).toBe(true)
    expect(hasCriterion({ postedFrom: '2026-08-01' })).toBe(true)
    expect(hasCriterion({ postedTo: '2026-08-14' })).toBe(true)
  })
})

describe('readCriteria', () => {
  it('reads every key the door takes', () => {
    const c = readCriteria(
      params(
        'view=ledger&entry=143&store=0142&kind=SHORTAGE&status=OPEN&batch=01J8&from=2026-08-01&to=2026-08-14',
      ),
    )

    expect(c).toEqual({
      entryNumber: 143,
      storeId: '0142',
      entryKind: 'SHORTAGE',
      status: 'OPEN',
      batchId: '01J8',
      postedFrom: '2026-08-01',
      postedTo: '2026-08-14',
    })
  })

  it('drops an unreadable value instead of passing it on or throwing', () => {
    // 🚩 The door validates its own vocabulary and would 400 on `OPENISH` — which is
    // right there and wrong here: a typo in a pasted address must leave the reader on
    // a screen with the chip visibly unset, not on an error banner.
    const c = readCriteria(params('status=OPENISH&kind=SIDEWAYS&entry=abc&from=not-a-date'))

    expect(c.status).toBeUndefined()
    expect(c.entryKind).toBeUndefined()
    expect(c.entryNumber).toBeUndefined()
    expect(c.postedFrom).toBeUndefined()
  })

  it('drops a date that passes the shape but is not a day', () => {
    // ⚠️ `2026-02-31` matches any YYYY-MM-DD regex. `Date` rolls it forward to March
    // 3rd without complaining, which would silently shift the range the accountant
    // asked for — so the value is checked against its own round-trip.
    expect(readCriteria(params('from=2026-02-31')).postedFrom).toBeUndefined()
    expect(readCriteria(params('from=2026-02-28')).postedFrom).toBe('2026-02-28')
    // A leap day in a leap year is a real day and must survive.
    expect(readCriteria(params('from=2028-02-29')).postedFrom).toBe('2028-02-29')
    expect(readCriteria(params('from=2026-02-29')).postedFrom).toBeUndefined()
  })

  it('accepts a lower-cased vocabulary word, since a human types the address', () => {
    expect(readCriteria(params('status=open&kind=surplus')).status).toBe('OPEN')
    expect(readCriteria(params('status=open&kind=surplus')).entryKind).toBe('SURPLUS')
  })

  it('refuses an entry number that is a branch code in the wrong box', () => {
    // A leading zero is a four-digit branch code, not an entry number.
    expect(readCriteria(params('entry=0142')).entryNumber).toBeUndefined()
    expect(readCriteria(params('entry=0')).entryNumber).toBeUndefined()
    expect(readCriteria(params('entry=143')).entryNumber).toBe(143)
  })

  it('reads a bare key as absent rather than as an empty branch', () => {
    const c = readCriteria(params('store=&batch=&entry='))
    expect(c.storeId).toBeUndefined()
    expect(c.batchId).toBeUndefined()
    expect(hasCriterion(c)).toBe(false)
  })
})

describe('ledgerSearch', () => {
  /** The address as a router would read it — 283 made these builders return
   *  `path?search`, so a test that treated the answer as a query string alone would
   *  be reading the pathname as its first key. */
  const address = (built: string) => new URL(built, 'http://x')

  it('keeps the scope and drops everything else', () => {
    // 🚩 Widening to the estate is a decision the reader made; walking into a lookup
    // must not quietly undo it. And a search that took them here has done its job.
    const url = address(ledgerSearch(params('scope=all&q=riyadh&store=0999'), { status: 'OPEN' }))

    expect(url.searchParams.get('scope')).toBe('all')
    expect(url.searchParams.get('status')).toBe('OPEN')
    expect(url.searchParams.get('q')).toBeNull()
    expect(url.searchParams.get('store')).toBeNull()
  })

  it('omits an empty criterion rather than leaving a bare key behind', () => {
    const search = ledgerSearch(params(''), { status: 'OPEN', storeId: '', batchId: undefined })

    expect(search).not.toContain('store=')
    expect(search).not.toContain('batch=')
  })

  it('round-trips through readCriteria', () => {
    const criteria = {
      entryNumber: 143,
      storeId: '0142',
      entryKind: 'SURPLUS' as const,
      status: 'CLOSED_OUT' as const,
      batchId: '01J8ABC',
      postedFrom: '2026-08-01',
      postedTo: '2026-08-14',
    }

    expect(readCriteria(address(ledgerSearch(params(''), criteria)).searchParams)).toEqual(criteria)
  })

  /**
   * 🔑 **283: the PATH is what says which screen, and the builder always names it.**
   *
   * The ledger and the branch account share `?store=` on purpose — one word for one
   * thing — so before 283 a criteria-only address opened the ACCOUNT, and `view=` was
   * the only thing standing between the two. The path is that thing now, and it
   * cannot be left off by a caller assembling criteria.
   */
  it('always names its own screen, so the address cannot land on the branch account', () => {
    expect(address(ledgerSearch(params(''), { storeId: '0142' })).pathname).toBe(LEDGER_PATH)
    expect(address(ledgerSearch(params(''), {})).pathname).toBe(LEDGER_PATH)
  })

  it('carries no query string at all when it is asking nothing', () => {
    expect(ledgerSearch(params(''), {})).toBe(LEDGER_PATH)
  })
})

describe('ledgerKey', () => {
  it('is the same for two URLs asking the same question', () => {
    const a = readCriteria(params('view=ledger&status=OPEN&store=0142'))
    const b = readCriteria(params('store=0142&q=leftover&view=ledger&status=OPEN'))

    // 🚩 Built from the criteria, not the search string — so a stray `?q=` left over
    // from the door does not fork the cache into two identical answers.
    expect(ledgerKey(a)).toBe(ledgerKey(b))
  })

  it('separates questions that differ in one criterion', () => {
    expect(ledgerKey({ status: 'OPEN' })).not.toBe(ledgerKey({ status: 'CONSUMED' }))
    expect(ledgerKey({ storeId: '0142' })).not.toBe(ledgerKey({ batchId: '0142' }))
  })
})

describe('the vocabulary', () => {
  it('offers OPEN first — it is the status an accountant asks for by itself', () => {
    expect(LEDGER_STATUSES[0]).toBe('OPEN')
  })
})

/**
 * Spec 2423 (ticket 426): Amount From/To, Profit center and Posted by. The proof the
 * ticket names — *the new filters map to URL params and satisfy the criterion rule* —
 * on both halves of "URL": the screen's own address and the door's query.
 */
describe('ledger new filters map to URL params and satisfy the criterion rule', () => {
  it('each new criterion alone satisfies the rule — "amount ≥ 1,000" is a valid search', () => {
    expect(hasCriterion({ amountFrom: 1000 })).toBe(true)
    expect(hasCriterion({ amountTo: 50 })).toBe(true)
    expect(hasCriterion({ profitCenter: 'P1' })).toBe(true)
    expect(hasCriterion({ postedByStaffId: 'ACC7' })).toBe(true)
  })

  it('counts a 0 bound — it is a bound, not the absence of one', () => {
    expect(hasCriterion({ amountFrom: 0 })).toBe(true)
    expect(hasCriterion({ amountTo: 0 })).toBe(true)
  })

  it('does not count an empty profit center or poster', () => {
    expect(hasCriterion({ profitCenter: '', postedByStaffId: '' })).toBe(false)
  })

  it('reads the four from the address', () => {
    const c = readCriteria(params('amountFrom=1000&amountTo=2500.5&profitCenter=%20P12%20&postedBy=ACC7'))
    expect(c).toMatchObject({
      amountFrom: 1000,
      amountTo: 2500.5,
      profitCenter: 'P12',
      postedByStaffId: 'ACC7',
    })
    expect(hasCriterion(c)).toBe(true)
  })

  it('drops an unreadable amount rather than guessing at it', () => {
    // 🚩 `1,000` read as 1 or as 1000 would each answer a different question silently.
    for (const raw of ['1,000', '-5', 'abc', '1e3', '']) {
      expect(readCriteria(params(`amountFrom=${encodeURIComponent(raw)}`)).amountFrom).toBeUndefined()
    }
    expect(readCriteria(params('amountTo=.5')).amountTo).toBe(0.5)
    expect(readCriteria(params('amountTo=0')).amountTo).toBe(0)
  })

  it('🚩 holds an amount to money’s scale, so every bound it writes reads back as itself', () => {
    // Past three decimals or twelve whole digits `String(n)` can turn exponential
    // (`1e-7`), which the reader would then drop while the address still showed it.
    expect(readLedgerAmount('0.0000001')).toBeUndefined()
    expect(readLedgerAmount('1234567890123')).toBeUndefined()
    expect(readLedgerAmount('45.750')).toBe(45.75)
    for (const typed of ['999999999999.999', '0.001', '.5', '45.750', '1000.']) {
      const amount = readLedgerAmount(typed)!
      const href = ledgerSearch(params(''), { amountFrom: amount })
      expect(readCriteria(new URLSearchParams(href.slice(href.indexOf('?')))).amountFrom).toBe(amount)
    }
  })

  it('writes them into the screen address and round-trips', () => {
    const asked = { amountFrom: 0, amountTo: 2500.5, profitCenter: 'P12', postedByStaffId: 'ACC7' }
    const href = ledgerSearch(params(''), asked)
    const search = new URLSearchParams(href.slice(href.indexOf('?')))

    expect(search.get('amountFrom')).toBe('0')
    expect(search.get('amountTo')).toBe('2500.5')
    expect(search.get('profitCenter')).toBe('P12')
    expect(search.get('postedBy')).toBe('ACC7')
    expect(readCriteria(search)).toMatchObject(asked)
  })

  it('sends them to the door under its own camelCase names', () => {
    const query = ledgerQuery({ amountFrom: 1000, amountTo: 2000, profitCenter: 'P12', postedByStaffId: 'ACC7' })

    expect(query).toMatchObject({
      amountFrom: 1000,
      amountTo: 2000,
      profitCenter: 'P12',
      postedByStaffId: 'ACC7',
    })
  })

  it('never sends an unset criterion — only what was asked has a value', () => {
    const query = ledgerQuery(readCriteria(params('amountFrom=1000')))
    const sent = Object.entries(query).filter(([, v]) => v !== undefined && v !== '')

    expect(sent).toEqual([['amountFrom', 1000]])
  })

  it('still sends every older criterion under its old name', () => {
    const query = ledgerQuery(
      readCriteria(params('entry=143&store=0142&kind=SHORTAGE&status=OPEN&batch=01J8&from=2026-08-01&to=2026-08-14')),
    )

    expect(query).toMatchObject({
      entryNumber: 143,
      storeId: '0142',
      entryKind: 'SHORTAGE',
      status: 'OPEN',
      batchId: '01J8',
      postedFrom: '2026-08-01',
      postedTo: '2026-08-14',
    })
  })

  it('forks the cache key on each new criterion', () => {
    const base = ledgerKey({ status: 'OPEN' })
    expect(ledgerKey({ status: 'OPEN', amountFrom: 1000 })).not.toBe(base)
    expect(ledgerKey({ status: 'OPEN', amountTo: 1000 })).not.toBe(ledgerKey({ status: 'OPEN', amountFrom: 1000 }))
    expect(ledgerKey({ status: 'OPEN', profitCenter: 'P1' })).not.toBe(base)
    expect(ledgerKey({ status: 'OPEN', postedByStaffId: 'ACC7' })).not.toBe(base)
  })
})
