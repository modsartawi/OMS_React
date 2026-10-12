/**
 * Ticket 477 — the Deliverect stores page's pure rules: a null location reads onboarded-not-linked,
 * the optional sync/status columns follow the data, the URL is the query, the account choices
 * survive a refused `Accounts` read, and the direct-HungerStation answer is a warning.
 */
import { describe, expect, it } from 'vitest'
import type { DeliverectStoreRow } from '@/core/models/deliverect'
import { accountChoices, onboardWarning, optionalColumns, storeState, storesFromParams, storesToParams } from './store-state'

/** A store row exactly as the contract has it, sync and status still null (2624/2625 not shipped). */
const row = (over: Partial<DeliverectStoreRow> = {}): DeliverectStoreRow => ({
  storeCode: '1234',
  storeName: 'Riyadh Olaya',
  accountKey: 'OlaCare',
  deliverectLocationId: '64f0c2',
  onboardedAt: '2026-10-12T10:00:00',
  onboardedBy: 'HSADMIN',
  linkedAt: '2026-10-12T10:05:00',
  onDirectHungerStation: false,
  sync: null,
  status: null,
  ...over,
})

describe('storeState', () => {
  it('a null location reads as onboarded, not linked', () => {
    expect(storeState(row({ deliverectLocationId: null, linkedAt: null }))).toBe('notLinked')
  })

  it('a location reads as linked', () => {
    expect(storeState(row())).toBe('linked')
  })
})

describe('optionalColumns', () => {
  it('no column while every row carries null sync and status (before 2624/2625)', () => {
    expect(optionalColumns([row(), row({ storeCode: '0099' })])).toEqual({ sync: false, status: false })
    expect(optionalColumns([])).toEqual({ sync: false, status: false })
  })

  it('a column once any row carries its block — each on its own', () => {
    const sync = { active: false, lastFullRun: null, lastDeltaRun: null, lastStatus: null, lastError: null }
    expect(optionalColumns([row(), row({ sync })])).toEqual({ sync: true, status: false })
    expect(optionalColumns([row({ status: { state: 'busy', since: '2026-10-12T11:00:00', reason: null } })])).toEqual({
      sync: false,
      status: true,
    })
  })
})

describe('the URL is the query', () => {
  it('an empty URL is the contract defaults', () => {
    expect(storesFromParams(new URLSearchParams())).toEqual({ account: null, linked: 'any', q: null })
  })

  it('reads account, linked and q; trims q; an unknown linked is any', () => {
    expect(storesFromParams(new URLSearchParams('account=OlaCare&linked=no&q=%20olaya%20'))).toEqual({
      account: 'OlaCare',
      linked: 'no',
      q: 'olaya',
    })
    expect(storesFromParams(new URLSearchParams('linked=maybe')).linked).toBe('any')
  })

  it('writes back only what differs from the defaults, and round-trips', () => {
    expect(storesToParams({ account: null, linked: 'any', q: null }).toString()).toBe('')
    const query = { account: 'AlDawaa', linked: 'yes' as const, q: '0012' }
    expect(storesToParams(query).toString()).toBe('account=AlDawaa&linked=yes&q=0012')
    expect(storesFromParams(storesToParams(query))).toEqual(query)
  })
})

describe('accountChoices', () => {
  const accounts = [
    { accountKey: 'OlaCare', deliverectAccountId: 'a1', active: true },
    { accountKey: 'AlDawaa', deliverectAccountId: 'a2', active: false },
  ]

  it('with the Accounts read: its keys, sorted', () => {
    expect(accountChoices(accounts, ['Other'])).toEqual(['AlDawaa', 'OlaCare'])
  })

  it('🚩 without it (403): the distinct keys of the store rows', () => {
    expect(accountChoices(undefined, ['OlaCare', 'AlDawaa', 'OlaCare'])).toEqual(['AlDawaa', 'OlaCare'])
  })

  it('keeps the value the list is filtered by, even when no row carries it', () => {
    expect(accountChoices(undefined, [], ['OlaCare', null])).toEqual(['OlaCare'])
  })
})

describe('onboardWarning', () => {
  it('nothing to warn about off the direct HungerStation rail, whatever the message', () => {
    expect(onboardWarning(row(), 'Onboarded.')).toBeNull()
  })

  it('a direct HungerStation store warns with the server’s own words', () => {
    const message = 'Store 1234 is on the direct HungerStation rail. / الفرع 1234 على مسار هنقرستيشن المباشر.'
    expect(onboardWarning(row({ onDirectHungerStation: true }), message)).toEqual({ storeCode: '1234', message })
  })

  it('a success with no row (data null) warns of nothing rather than throwing', () => {
    expect(onboardWarning(null, 'anything')).toBeNull()
  })

  it('and still warns when the server sent no words', () => {
    expect(onboardWarning(row({ onDirectHungerStation: true }), '  ')).toEqual({ storeCode: '1234', message: null })
  })
})
