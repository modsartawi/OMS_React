/**
 * The flat cross-estate ledger's rules (ticket 270, spec 267 D2).
 *
 * Two properties, both of which a component would get wrong quietly:
 *
 * - **filter-first** — an unfiltered ledger is the 1394-branch list this design
 *   refused, arriving through the back door;
 * - 🚩 the figures are a **report**, per currency and never netted. This view can
 *   only assert a total nobody owes and nobody consumes.
 */
import { describe, expect, it } from 'vitest'
import { SETTLEMENT_LEDGER } from './fleet-fixture'
import {
  EMPTY_LEDGER_CRITERIA,
  buildLedgerParams,
  criteriaForEntryNumber,
  hasLedgerCriteria,
  readLedgerCriteria,
  writeLedgerCriteria,
} from './ledger'

describe('filter-first', () => {
  it('🔑 blank criteria are not a search for everything', () => {
    expect(hasLedgerCriteria(EMPTY_LEDGER_CRITERIA)).toBe(false)
    expect(hasLedgerCriteria({ ...EMPTY_LEDGER_CRITERIA, entryNumber: '  ' })).toBe(false)
  })

  it('one criterion is enough to ask a question', () => {
    expect(hasLedgerCriteria({ ...EMPTY_LEDGER_CRITERIA, entryNumber: '143' })).toBe(true)
    expect(hasLedgerCriteria({ ...EMPTY_LEDGER_CRITERIA, status: 'OPEN' })).toBe(true)
  })

  it('sends the criteria trimmed, and leaves the blanks for buildQuery to drop', () => {
    expect(buildLedgerParams({ ...EMPTY_LEDGER_CRITERIA, entryNumber: ' 143 ', status: 'OPEN' })).toEqual({
      entryNumber: '143',
      storeId: '',
      entryKind: '',
      status: 'OPEN',
    })
  })

  it('turns an entry number from the search box into one criterion and no others', () => {
    expect(criteriaForEntryNumber(143)).toEqual({ ...EMPTY_LEDGER_CRITERIA, entryNumber: '143' })
  })

  it('finds ONE entry in an estate-sized ledger — the view’s whole job', () => {
    // "Entry 143, whichever branch it is on."
    const hits = SETTLEMENT_LEDGER.filter((r) => r.entryNumber === 143)
    expect(hits).toHaveLength(1)
    expect(hits[0].storeId).toBe('0142')
  })
})

describe('the ledger’s filter is an ADDRESS', () => {
  it('round-trips through a URL, and keeps `branch` clear of `?store=`', () => {
    const criteria = { entryNumber: '143', storeId: '0455', entryKind: 'SHORTAGE', status: 'OPEN' } as const
    const url = writeLedgerCriteria(new URLSearchParams('scope=all'), criteria)

    // 🚩 `branch`, never `store` — `?store=` already means *open this account*, and
    // one address may not mean two screens.
    expect(url.get('branch')).toBe('0455')
    expect(url.get('store')).toBeNull()
    expect(url.get('scope')).toBe('all')
    expect(readLedgerCriteria(url)).toEqual(criteria)
  })

  it('leaves no trace of a cleared filter in the address', () => {
    const url = writeLedgerCriteria(
      new URLSearchParams('entryNumber=143&branch=0455&kind=SHORTAGE&status=OPEN'),
      EMPTY_LEDGER_CRITERIA,
    )
    expect(url.toString()).toBe('')
  })

  it('degrades a hand-edited enum to *any* rather than to a broken screen', () => {
    expect(readLedgerCriteria(new URLSearchParams('kind=BANANA&status=nonsense'))).toEqual(
      EMPTY_LEDGER_CRITERIA,
    )
    // …and reads a lower-cased one, because an address gets typed by humans.
    expect(readLedgerCriteria(new URLSearchParams('status=open')).status).toBe('OPEN')
  })
})
