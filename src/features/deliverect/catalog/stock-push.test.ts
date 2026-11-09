/**
 * Ticket 860 (BackOffice spec 3481) — the on-demand stock push as the catalog screen reads it: the
 * import's `push` block (3485) and `Stock/Push`'s answer and refusals (3483). Fixtures are the
 * contract's own shapes.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { DeliverectImportPush, DeliverectStockPushAccount } from '@/core/models/deliverect'
import { STOCK_PUSH_MAX, importPushView, namedMaterials, pushAccountsView, pushNowRefusal } from './stock-push'

const ok: DeliverectStockPushAccount = { accountKey: 'OlaCare', stores: ['1001', '1002'], rows: 6, fileId: 'f-1', status: 'S', error: null }
const bad: DeliverectStockPushAccount = {
  accountKey: 'AlDawaa',
  stores: ['2001'],
  rows: 3,
  fileId: null,
  status: 'E',
  error: 'Deliverect refused the inventory file (503): … / …',
}
const block = (over: Partial<DeliverectImportPush>): DeliverectImportPush => ({ skipped: false, why: null, error: null, accounts: [], ...over })

function refusal(errorCode: string, message: string, status = 400) {
  return new ApiError('business', message, status, [{ errorCode, internalErrorCode: '', errorMessage: message }])
}

describe('the cap', () => {
  it('is the contract’s 200', () => expect(STOCK_PUSH_MAX).toBe(200))
})

describe('importPushView — the import’s push block', () => {
  it('a server before 3485 sends no block: nothing is said', () => {
    expect(importPushView(undefined)).toEqual({ kind: 'absent' })
    expect(importPushView(null)).toEqual({ kind: 'absent' })
  })

  it.each(['pushStockOff', 'overCap', 'noKnownMaterials'] as const)('skipped (%s) says why', (why) => {
    expect(importPushView(block({ skipped: true, why }))).toEqual({ kind: 'skipped', why })
  })

  it('a skip reason the contract does not name is still a skip, said generically', () => {
    expect(importPushView(block({ skipped: true, why: 'somethingNew' }))).toEqual({ kind: 'skipped', why: null })
  })

  it('a push that failed as a whole is a warning carrying the server’s sentence — never a failed import', () => {
    const v = importPushView(block({ error: 'The push could not be run; the import is saved. / …' }))
    expect(v).toEqual({ kind: 'failed', error: 'The push could not be run; the import is saved. / …' })
  })

  it('attempted, but no store reached', () => {
    expect(importPushView(block({ accounts: [] }))).toEqual({ kind: 'noStores' })
  })

  it('pushed: the accounts, with the totals and the failed count', () => {
    expect(importPushView(block({ accounts: [ok, bad] }))).toEqual({
      kind: 'pushed',
      ...pushAccountsView([ok, bad]),
    })
  })
})

describe('pushAccountsView — per account', () => {
  it('totals the stores and rows, and counts an "E" account as failed', () => {
    const v = pushAccountsView([ok, bad])
    expect(v.stores).toBe(3)
    expect(v.rows).toBe(9)
    expect(v.failed).toBe(1)
    expect(v.accounts.map((a) => [a.accountKey, a.failed])).toEqual([
      ['OlaCare', false],
      ['AlDawaa', true],
    ])
  })

  it('any status but "S" is a failure (the contract enumerates nothing else)', () => {
    expect(pushAccountsView([{ ...ok, status: 'X' }]).failed).toBe(1)
  })

  it('a missing stores array or rows count reads as none rather than throwing', () => {
    const v = pushAccountsView([{ ...ok, stores: undefined as unknown as string[], rows: null as unknown as number }])
    expect(v.stores).toBe(0)
    expect(v.rows).toBe(0)
    expect(v.accounts[0].stores).toEqual([])
    expect(v.accounts[0].rows).toBe(0)
  })
})

describe('namedMaterials — the materials a DLV-00004 message names', () => {
  it('matches whole tokens only, case-insensitively, in the order sent', () => {
    const msg = 'Not on the whitelist: 101236, abc9. / ليست في القائمة: 101236، ABC9.'
    expect(namedMaterials(msg, ['101234', '1012', 'ABC9', '101236'])).toEqual(['ABC9', '101236'])
  })

  it('a number with a hyphen or a dot is matched whole', () => {
    expect(namedMaterials('Not on the whitelist: MAT-1001, 7.5. / …', ['MAT-1001', '7.5', '75'])).toEqual(['MAT-1001', '7.5'])
  })

  it('names nothing when the message names nothing it was sent', () => {
    expect(namedMaterials('Not on the whitelist. / …', ['101234'])).toEqual([])
  })
})

describe('pushNowRefusal — the door’s refusals, by code', () => {
  const sent = ['101234', '999999']

  it('DLV-00004: not whitelisted, with the materials named', () => {
    const r = pushNowRefusal(refusal('DLV-00004', 'Not on the whitelist: 999999. / ليست في القائمة: 999999.', 404), sent, 'fb')
    expect(r).toEqual({ kind: 'notWhitelisted', code: 'DLV-00004', message: 'Not on the whitelist: 999999. / ليست في القائمة: 999999.', materials: ['999999'] })
  })

  it('DLV-00015: empty or over the cap', () => {
    const r = pushNowRefusal(refusal('DLV-00015', 'More than 200. / أكثر من 200.'), sent, 'fb')
    expect(r).toEqual({ kind: 'invalidList', code: 'DLV-00015', message: 'More than 200. / أكثر من 200.', materials: [] })
  })

  it('the reason refusal (DLV-00009) is the reason field’s, not the list’s', () => {
    expect(pushNowRefusal(refusal('DLV-00009', 'Reason required. / …'), sent, 'fb')).toBeNull()
  })

  it('no error, no refusal', () => expect(pushNowRefusal(null, sent, 'fb')).toBeNull())
})
