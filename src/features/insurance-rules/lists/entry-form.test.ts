/**
 * Ticket 610 — an entry of a patient list (National ID / Iqama) or a policy list (SubscriberId): a key, a
 * reason, an optional expiry in the LOCAL future. Refused here before the POST.
 */
import { describe, expect, it } from 'vitest'
import { entryBody, entryProblems } from './entry-form'

const today = '2026-10-27'
const ok = { key: '1012345678', reason: 'Board member', expiresOn: '' }

describe('entryProblems', () => {
  it('a National ID (1…) or an Iqama (2…), ten digits, not already on the list', () => {
    expect(entryProblems(ok, 'patient', [], today)).toEqual([])
    expect(entryProblems({ ...ok, key: '2412345678' }, 'patient', [], today)).toEqual([])
    expect(entryProblems({ ...ok, key: '' }, 'patient', [], today)).toEqual(['keyMissing'])
    expect(entryProblems({ ...ok, key: '3012345678' }, 'patient', [], today)).toEqual(['keyInvalid'])
    expect(entryProblems({ ...ok, key: '101234567' }, 'patient', [], today)).toEqual(['keyInvalid'])
    expect(entryProblems({ ...ok, key: ' 1012345678 ' }, 'patient', ['1012345678'], today)).toEqual(['keyListed'])
  })

  it('a policy list takes any SubscriberId without spaces', () => {
    expect(entryProblems({ ...ok, key: 'SASREF-0042' }, 'policy', [], today)).toEqual([])
    expect(entryProblems({ ...ok, key: 'SAS REF' }, 'policy', [], today)).toEqual(['keyInvalid'])
  })

  it('a reason is required and capped at 200', () => {
    expect(entryProblems({ ...ok, reason: '  ' }, 'patient', [], today)).toEqual(['reasonMissing'])
    expect(entryProblems({ ...ok, reason: 'x'.repeat(201) }, 'patient', [], today)).toEqual(['reasonTooLong'])
  })

  it('an expiry is a local day after today', () => {
    expect(entryProblems({ ...ok, expiresOn: '2026-10-28' }, 'patient', [], today)).toEqual([])
    expect(entryProblems({ ...ok, expiresOn: today }, 'patient', [], today)).toEqual(['expiryPast'])
    expect(entryProblems({ ...ok, expiresOn: '28/10/2026' }, 'patient', [], today)).toEqual(['expiryInvalid'])
  })
})

describe('entryBody', () => {
  it('trims, and leaves the expiry out when there is none', () => {
    expect(entryBody({ key: ' 1012345678 ', reason: ' Board member ', expiresOn: '' })).toEqual({ key: '1012345678', reason: 'Board member' })
    expect(entryBody({ key: '1012345678', reason: 'r', expiresOn: '2027-01-31' })).toEqual({ key: '1012345678', reason: 'r', expiresOn: '2027-01-31' })
  })
})
