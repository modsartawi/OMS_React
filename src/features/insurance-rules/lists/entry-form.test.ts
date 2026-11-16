/**
 * Ticket 610 — an entry of a patient list (National ID / Iqama) or a policy list (SubscriberId): a key, a
 * reason, an optional expiry in the LOCAL future. Refused here before the POST.
 */
import { describe, expect, it } from 'vitest'
import { entryAction, entryBody, entryIdentity, entryProblems, newListBody, newListProblems } from './entry-form'

const today = '2026-10-27'
const ok = { key: '1012345678', reason: 'Board member', expiresOn: '' }

describe('entryProblems', () => {
  it('a National ID (1…) or an Iqama (2…), ten digits, not already on the list', () => {
    expect(entryProblems(ok, 'patient', today)).toEqual([])
    expect(entryProblems({ ...ok, key: '2412345678' }, 'patient', today)).toEqual([])
    expect(entryProblems({ ...ok, key: '' }, 'patient', today)).toEqual(['keyMissing'])
    expect(entryProblems({ ...ok, key: '3012345678' }, 'patient', today)).toEqual(['keyInvalid'])
    expect(entryProblems({ ...ok, key: '101234567' }, 'patient', today)).toEqual(['keyInvalid'])
    // A key already there is a change (HQ replaces its reason and expiry, logged `change`), not a refusal.
    expect(entryProblems({ ...ok, key: ' 1012345678 ' }, 'patient', today)).toEqual([])
  })

  it('a policy list takes any SubscriberId without spaces', () => {
    expect(entryProblems({ ...ok, key: 'SASREF-0042' }, 'policy', today)).toEqual([])
    expect(entryProblems({ ...ok, key: 'SAS REF' }, 'policy', today)).toEqual(['keyInvalid'])
  })

  it('a reason is required and capped at 200', () => {
    expect(entryProblems({ ...ok, reason: '  ' }, 'patient', today)).toEqual(['reasonMissing'])
    expect(entryProblems({ ...ok, reason: 'x'.repeat(201) }, 'patient', today)).toEqual(['reasonTooLong'])
  })

  it('an expiry is the last local day it counts: today or later (3133)', () => {
    expect(entryProblems({ ...ok, expiresOn: '2026-10-28' }, 'patient', today)).toEqual([])
    expect(entryProblems({ ...ok, expiresOn: today }, 'patient', today)).toEqual([])
    expect(entryProblems({ ...ok, expiresOn: '2026-10-26' }, 'patient', today)).toEqual(['expiryPast'])
    expect(entryProblems({ ...ok, expiresOn: '28/10/2026' }, 'patient', today)).toEqual(['expiryInvalid'])
  })
})

describe('entryBody', () => {
  it('trims, and leaves the expiry out when there is none', () => {
    expect(entryBody({ key: ' 1012345678 ', reason: ' Board member ', expiresOn: '' })).toEqual({ key: '1012345678', reason: 'Board member' })
    expect(entryBody({ key: '1012345678', reason: 'r', expiresOn: '2027-01-31' })).toEqual({ key: '1012345678', reason: 'r', expiresOn: '2027-01-31' })
  })
})

describe('a class-list entry (BackOffice 3172)', () => {
  const cls = { key: 'vip-a', reason: 'Gold class', expiresOn: '', payer: '' }
  it('a class code up to 29 characters, no `|`, matched upper case', () => {
    expect(entryProblems(cls, 'class', today)).toEqual([])
    expect(entryProblems({ ...cls, key: 'A'.repeat(29) }, 'class', today)).toEqual([])
    expect(entryProblems({ ...cls, key: 'A'.repeat(30) }, 'class', today)).toEqual(['keyInvalid'])
    expect(entryProblems({ ...cls, key: 'VIP|A' }, 'class', today)).toEqual(['keyInvalid'])
  })
  it('entryAction_changesAKeyAlreadyListed — the same class for one insurer and for any insurer are two entries', () => {
    const listed = [entryIdentity('VIP-A', null)]
    expect(entryAction(cls, 'class', listed)).toBe('change')
    expect(entryProblems(cls, 'class', today)).toEqual([])
    expect(entryAction({ ...cls, payer: '1000123' }, 'class', listed)).toBe('add')
    expect(entryAction({ ...cls, key: ' vip-a ', payer: '1000123' }, 'class', [entryIdentity('VIP-A', '1000123')])).toBe('change')
    expect(entryAction(ok, 'patient', [entryIdentity('1012345678')])).toBe('change')
    expect(entryAction(ok, 'patient', [])).toBe('add')
  })
  it('an insurer is its SAP customer id, up to 10', () => {
    expect(entryProblems({ ...cls, payer: '12345678901' }, 'class', today)).toEqual(['payerInvalid'])
  })
  it('the body upper-cases the class and carries the insurer only when one is picked', () => {
    expect(entryBody({ ...cls, key: ' vip-a ' }, 'class')).toEqual({ key: 'VIP-A', reason: 'Gold class' })
    expect(entryBody({ ...cls, payer: '1000123', expiresOn: '2026-11-30' }, 'class')).toEqual({ key: 'VIP-A', payer: '1000123', reason: 'Gold class', expiresOn: '2026-11-30' })
  })
  it('a policy body never carries a payer (a patient body carries the reporting payer: 3982)', () => {
    expect(entryBody({ ...ok, key: 'SUB-1', payer: '1000123' }, 'policy')).toEqual({ key: 'SUB-1', reason: 'Board member' })
  })
})

describe('a new patient, policy or class list (3133: `POST … { id, name: { en, ar }, reason }`)', () => {
  const list = { id: 'CL-GOLD', en: 'Gold classes', ar: 'فئات ذهبية' }
  it('an id of letters, digits, `.` `_` `-`, up to 40, not taken; a name in both languages', () => {
    expect(newListProblems(list, [])).toEqual([])
    expect(newListProblems({ ...list, id: 'CL GOLD' }, [])).toEqual(['idInvalid'])
    expect(newListProblems({ ...list, id: 'x'.repeat(41) }, [])).toEqual(['idInvalid'])
    expect(newListProblems({ ...list, id: '' }, [])).toEqual(['idInvalid'])
    expect(newListProblems(list, ['CL-GOLD'])).toEqual(['idTaken'])
    expect(newListProblems({ ...list, ar: ' ' }, [])).toEqual(['nameMissing'])
  })
  it('the body is trimmed and carries the reason', () => {
    expect(newListBody({ ...list, id: ' CL-GOLD ', en: ' Gold classes ' }, 'gone')).toEqual({ id: 'CL-GOLD', name: { en: 'Gold classes', ar: 'فئات ذهبية' }, reason: 'gone' })
  })
})

describe('a blocked-patient entry (BackOffice 3982)', () => {
  const blocked = { key: '1039820001', reason: 'Bupa finding', expiresOn: '', reasonKind: 'fraud' as const, payer: 'BUPA', reference: 'PA 45678', startsOn: '' }

  it('the kind is required only where the list asks for it, and is abuse or fraud', () => {
    expect(entryProblems(blocked, 'patient', today, { reasonKindRequired: true })).toEqual([])
    expect(entryProblems({ ...blocked, reasonKind: '' }, 'patient', today, { reasonKindRequired: true })).toEqual(['reasonKindMissing'])
    expect(entryProblems({ ...blocked, reasonKind: '' }, 'patient', today)).toEqual([])
  })

  it('a start day is a date, may be backdated, and is not after the end day (both inclusive)', () => {
    expect(entryProblems({ ...blocked, startsOn: '2026-10-01' }, 'patient', today)).toEqual([])
    expect(entryProblems({ ...blocked, startsOn: '2026-11-01', expiresOn: '2026-11-01' }, 'patient', today)).toEqual([])
    expect(entryProblems({ ...blocked, startsOn: '2026-11-02', expiresOn: '2026-11-01' }, 'patient', today)).toEqual(['startAfterExpiry'])
    expect(entryProblems({ ...blocked, startsOn: '1/11/2026' }, 'patient', today)).toEqual(['startInvalid'])
  })

  it('the reporting payer is a code up to 40 (it may hold spaces: NPHIES names); the reference up to 500', () => {
    expect(entryProblems({ ...blocked, payer: 'GIG (Previously AXA)' }, 'patient', today)).toEqual([])
    expect(entryProblems({ ...blocked, payer: 'x'.repeat(41) }, 'patient', today)).toEqual(['payerInvalid'])
    expect(entryProblems({ ...blocked, reference: 'x'.repeat(501) }, 'patient', today)).toEqual(['referenceTooLong'])
  })

  it('the body carries the four fields, trimmed, and leaves out the blank ones', () => {
    expect(entryBody({ ...blocked, payer: ' BUPA ', reference: ' PA 45678 ', startsOn: '2026-11-20', expiresOn: '2027-02-20' }, 'patient')).toEqual({
      key: '1039820001',
      payer: 'BUPA',
      reason: 'Bupa finding',
      reasonKind: 'fraud',
      reference: 'PA 45678',
      startsOn: '2026-11-20',
      expiresOn: '2027-02-20',
    })
    expect(entryBody({ ...blocked, reasonKind: '', payer: '', reference: '' }, 'patient')).toEqual({ key: '1039820001', reason: 'Bupa finding' })
  })

  it('a policy or class entry never carries the patient fields', () => {
    expect(entryBody({ ...blocked, key: 'SUB-1' }, 'policy')).toEqual({ key: 'SUB-1', reason: 'Bupa finding' })
  })
})

describe('a new patient list may ask every entry for its kind (BackOffice 3982)', () => {
  it('the body carries reasonKindRequired only when ticked', () => {
    const list = { id: 'blocked-patients', en: 'Blocked patients', ar: 'مرضى محظورون' }
    expect(newListBody({ ...list, reasonKindRequired: true }, 'BR-7')).toEqual({ id: 'blocked-patients', name: { en: 'Blocked patients', ar: 'مرضى محظورون' }, reason: 'BR-7', reasonKindRequired: true })
    expect(newListBody(list, 'BR-7')).toEqual({ id: 'blocked-patients', name: { en: 'Blocked patients', ar: 'مرضى محظورون' }, reason: 'BR-7' })
  })
})
