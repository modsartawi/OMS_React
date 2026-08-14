import { describe, expect, it } from 'vitest'

import {
  hasCriterion,
  isLedgerView,
  LEDGER_STATUSES,
  ledgerKey,
  ledgerSearch,
  readCriteria,
} from './ledger'

/**
 * `ledger.ts` — the cross-estate lookup's URL grammar and its one refusal.
 *
 * 🔑 The assertions worth having here are the ones a component test could not make
 * and a typecheck cannot see: that a hand-edited address DEGRADES rather than breaks,
 * that the empty question is recognised as empty, and that `view=ledger` is what
 * decides the screen — the last of which is a real defect if it regresses, because
 * the ledger and the branch account share the `?store=` key.
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
  it('keeps the scope and drops everything else', () => {
    // 🚩 Widening to the estate is a decision the reader made; walking into a lookup
    // must not quietly undo it. And a search that took them here has done its job.
    const search = ledgerSearch(params('scope=all&q=riyadh&store=0999'), { status: 'OPEN' })

    expect(search).toContain('scope=all')
    expect(search).toContain('view=ledger')
    expect(search).toContain('status=OPEN')
    expect(search).not.toContain('q=')
    expect(search).not.toContain('store=0999')
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

    expect(readCriteria(params(ledgerSearch(params(''), criteria)))).toEqual(criteria)
  })

  it('always names the view, so the address cannot land on the wrong screen', () => {
    // 🔑 The ledger and the branch account share `?store=`; `view=` is the only thing
    // that tells them apart. A criteria-only address would open the ACCOUNT.
    const search = ledgerSearch(params(''), { storeId: '0142' })

    expect(isLedgerView(params(search))).toBe(true)
  })
})

describe('isLedgerView', () => {
  it('is the view parameter and nothing else', () => {
    expect(isLedgerView(params('view=ledger&store=0142'))).toBe(true)
    // ⚠️ `?view=batch&batch=…` is 273's withdrawal, a different screen on a shared key.
    expect(isLedgerView(params('view=batch&batch=01J8'))).toBe(false)
    expect(isLedgerView(params('store=0142&entry=143'))).toBe(false)
    expect(isLedgerView(params(''))).toBe(false)
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
