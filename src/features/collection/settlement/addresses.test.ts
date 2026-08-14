/**
 * This screen's URL grammar (ticket 270).
 *
 * 🚩 The rule worth a test: **every link keeps the scope and drops the view.** The
 * defect it pins is quiet and expensive — an accountant who widened to the estate,
 * opened a branch and came back would find the ageing count had fallen from 140 to
 * 47, with nothing on screen to explain it, because a hand-written `?store=0142`
 * replaces the whole query string.
 */
import { describe, expect, it } from 'vitest'
import {
  batchSearch,
  branchSearch,
  doorSearch,
  isLedgerView,
  ledgerSearch,
  readBatchView,
  readQuery,
  readStore,
  scopeSearch,
  writeQuery,
} from './addresses'

const params = (search: string) => new URLSearchParams(search)

describe('🚩 every link keeps the scope', () => {
  it('carries a widened scope into a branch account', () => {
    expect(branchSearch(params('scope=all&q=0142'), '0142')).toBe('?scope=all&store=0142')
  })

  it('carries it back out to the door, and drops what took the reader away', () => {
    expect(doorSearch(params('scope=all&store=0142'))).toBe('?scope=all')
    expect(doorSearch(params('scope=unassigned&view=ledger&entryNumber=143'))).toBe(
      '?scope=unassigned',
    )
  })

  it('carries it into the ledger, with the ageing lane’s seed', () => {
    // The seed is typed criteria, written by the module that owns the keys - so a
    // branch seed lands on `branch=` and could not be hand-spelled as `store=`.
    const seeded = new URLSearchParams(
      ledgerSearch(params('scope=all'), { status: 'OPEN' }).slice(1),
    )
    expect(seeded.get('scope')).toBe('all')
    expect(seeded.get('view')).toBe('ledger')
    expect(seeded.get('status')).toBe('OPEN')
    expect(
      new URLSearchParams(ledgerSearch(params(''), { storeId: '0455' }).slice(1)).get('branch'),
    ).toBe('0455')
  })

  it('moves the scope without disturbing the view', () => {
    const widened = new URLSearchParams(
      scopeSearch(params('view=ledger&status=OPEN'), 'all').slice(1),
    )
    expect(widened.get('view')).toBe('ledger')
    expect(widened.get('status')).toBe('OPEN')
    expect(widened.get('scope')).toBe('all')
    // ...and the default is the ABSENCE of the parameter.
    expect(scopeSearch(params('scope=all'), 'mine')).toBe('.')
  })

  it('leaves the DEFAULT scope out of the address entirely', () => {
    // The plain route and *my branches* are one address, not two spellings of one.
    expect(doorSearch(params(''))).toBe('.')
    expect(branchSearch(params(''), '0331')).toBe('?store=0331')
  })
})

describe('…and drops everything that belongs to the view it left', () => {
  it('drops the search, the ledger filter and the view flag', () => {
    const busy = params('scope=all&q=Nakheel&view=ledger&entryNumber=143&branch=0455&status=OPEN')
    const next = new URLSearchParams(branchSearch(busy, '0142').slice(1))
    for (const key of ['q', 'view', 'entryNumber', 'branch', 'kind', 'status'])
      expect(next.get(key)).toBeNull()
    expect(next.get('store')).toBe('0142')
    expect(next.get('scope')).toBe('all')
  })
})

describe('reading the address', () => {
  it('reads a branch, and treats an empty one as no branch', () => {
    expect(readStore(params('store=0142'))).toBe('0142')
    expect(readStore(params('store=  '))).toBe('')
    expect(readStore(params(''))).toBe('')
  })

  it('knows the ledger view by its own name', () => {
    expect(isLedgerView(params('view=ledger'))).toBe(true)
    expect(isLedgerView(params('view=something'))).toBe(false)
    expect(isLedgerView(params(''))).toBe(false)
  })

  it('writes a query, and REMOVES it rather than leaving ?q= behind', () => {
    expect(writeQuery(params('scope=all'), 'Nakheel').toString()).toBe('scope=all&q=Nakheel')
    expect(writeQuery(params('scope=all&q=Nakheel'), '').toString()).toBe('scope=all')
    expect(readQuery(params('q=Nakheel'))).toBe('Nakheel')
  })
})

/**
 * The withdrawal view (273) — `?view=batch&batch=<id>`.
 *
 * 🚩 The batch is reachable an hour and a reload later because it is an **address**,
 * not state inside the dialog that committed it.
 */
describe('the batch withdrawal is an address', () => {
  it('keeps the scope and drops what led here', () => {
    const from = new URLSearchParams('scope=all&view=ledger&batch=01J9B&q=0142')
    expect(batchSearch(from, '01J9BATCHCLEAN')).toBe('?scope=all&view=batch&batch=01J9BATCHCLEAN')
  })

  // ⚠️ `view=` decides which screen draws — the ledger filtered TO a batch is a
  // lookup, not an act.
  it('is not opened by a bare ?batch= left over from a ledger filter', () => {
    expect(readBatchView(new URLSearchParams('view=ledger&batch=01J9B'))).toBe('')
    expect(readBatchView(new URLSearchParams('batch=01J9B'))).toBe('')
    expect(readBatchView(new URLSearchParams('view=batch&batch= 01J9B '))).toBe('01J9B')
    expect(readBatchView(new URLSearchParams('view=batch'))).toBe('')
  })
})
