/**
 * Ticket 621 (reconciled by 628) — the create / edit master form. Thresholds read "hard above N, reminder above M",
 * default to 4 and 1, are whole numbers, and a reminder threshold above the hard one is refused before anything is
 * sent. An insurer master needs its insurer's customer id (`insurerCustomerId`, 3161 D4 — sent trimmed, never
 * upper-cased or reshaped), a store list optional; a store master needs a store list; both names are required.
 */
import { describe, expect, it } from 'vitest'
import { badStoreCodes, clashingMasterId, masterBody, masterFormProblems, newMasterForm, OVERLAPPING_SCOPE, scopeClash, withKind } from './master-form'

const INSURER = '0001100336'

describe('master form defaults thresholds to 4 and 1 and refuses reminder above hard', () => {
  it('a new form starts at hard 4, reminder 1', () => {
    expect([newMasterForm().hard, newMasterForm().reminder]).toEqual(['4', '1'])
  })
  it('a reminder threshold above the hard one is refused on the reminder', () => {
    const f = { ...newMasterForm(), insurerCustomerId: INSURER, nameEn: 'Bupa', nameAr: 'بوبا', hard: '3', reminder: '5' }
    expect(masterFormProblems(f)).toEqual({ reminder: 'reminderAboveHard' })
  })
  it('equal thresholds and a zero reminder are allowed', () => {
    const f = { ...newMasterForm(), insurerCustomerId: INSURER, nameEn: 'Bupa', nameAr: 'بوبا', hard: '3', reminder: '3' }
    expect(masterFormProblems(f)).toEqual({})
    expect(masterFormProblems({ ...f, reminder: '0' })).toEqual({})
  })
  it('thresholds must be whole numbers of 0 or more', () => {
    const f = { ...newMasterForm(), insurerCustomerId: INSURER, nameEn: 'Bupa', nameAr: 'بوبا' }
    expect(masterFormProblems({ ...f, hard: '2.5', reminder: '' })).toEqual({ hard: 'wholeNumber', reminder: 'wholeNumber' })
    expect(masterFormProblems({ ...f, hard: '-1' })).toEqual({ hard: 'wholeNumber' })
  })
  it('the body is the door\'s shape: insurerCustomerId trimmed (leading zeros kept), thresholds as numbers', () => {
    const f = { ...newMasterForm(), insurerCustomerId: ' 0001100336 ', nameEn: ' Bupa ', nameAr: 'بوبا' }
    expect(masterBody(f)).toEqual({ kind: 'insurer', insurerCustomerId: '0001100336', storeListId: null, nameEn: 'Bupa', nameAr: 'بوبا', hardThreshold: 4, reminderThreshold: 1 })
    expect(Object.keys(masterBody(f))).not.toContain('payerCode')
  })
  it('the customer id is never upper-cased or reshaped', () => {
    const f = { ...newMasterForm(), insurerCustomerId: 'c-00011abc', nameEn: 'X', nameAr: 'س' }
    expect(masterBody(f).insurerCustomerId).toBe('c-00011abc')
  })
})

describe('master form requires an insurer for insurer and a store list for store', () => {
  it('an empty insurer form asks for the insurer and both names, not a store list', () => {
    expect(masterFormProblems(newMasterForm('insurer'))).toEqual({ insurerCustomerId: 'insurerRequired', nameEn: 'nameRequired', nameAr: 'nameRequired' })
  })
  it('an empty store form asks for a store list and both names, not an insurer', () => {
    expect(masterFormProblems(newMasterForm('store'))).toEqual({ storeListId: 'storeListRequired', nameEn: 'nameRequired', nameAr: 'nameRequired' })
  })
  it('an insurer master scoped to a store list sends both; a store master never sends an insurer', () => {
    const scoped = { ...newMasterForm('insurer'), insurerCustomerId: '0001100412', storeListId: 'SL-PILOT', nameEn: 'T', nameAr: 'ت' }
    expect([masterBody(scoped).insurerCustomerId, masterBody(scoped).storeListId]).toEqual(['0001100412', 'SL-PILOT'])
    const store = { ...newMasterForm('store'), insurerCustomerId: 'LEFTOVER', storeListId: 'SL-OPS', nameEn: 'O', nameAr: 'ع' }
    expect(masterFormProblems(store)).toEqual({})
    expect([masterBody(store).insurerCustomerId, masterBody(store).storeListId]).toEqual([null, 'SL-OPS'])
  })
  it('switching kind on create clears what belongs to the other kind', () => {
    const scoped = { ...newMasterForm('insurer'), insurerCustomerId: '0001100412', storeListId: 'SL-PILOT', nameEn: 'T', nameAr: 'ت', hard: '5' }
    // an insurer's scope never becomes a store master's list, and its insurer goes
    const store = withKind(scoped, 'store')
    expect(store).toEqual({ ...scoped, kind: 'store', insurerCustomerId: '', storeListId: '' })
    expect(masterFormProblems(store)).toEqual({ storeListId: 'storeListRequired' })
    // a store master's list never becomes an insurer's scope
    const picked = { ...store, storeListId: 'SL-OPS' }
    expect(withKind(picked, 'insurer')).toEqual({ ...picked, kind: 'insurer', storeListId: '' })
    expect(masterBody({ ...withKind(picked, 'insurer'), insurerCustomerId: INSURER }).storeListId).toBeNull()
    // picking the same kind again changes nothing
    expect(withKind(scoped, 'insurer')).toBe(scoped)
  })
  it('blank-only names count as missing', () => {
    const f = { ...newMasterForm('insurer'), insurerCustomerId: INSURER, nameEn: '   ', nameAr: 'بوبا' }
    expect(masterFormProblems(f)).toEqual({ nameEn: 'nameRequired' })
  })
})

describe('an overlap refusal (IDF-00015) names the clashing master and the shared stores', () => {
  it('the overlap code is the door\'s', () => {
    expect(OVERLAPPING_SCOPE).toBe('IDF-00015')
  })
  it('reads the clashing master id off the refusal data, defensively', () => {
    expect(clashingMasterId({ clashingMasterId: 'M-BUPA' })).toBe('M-BUPA')
    expect(clashingMasterId({ clashingMasterId: '' })).toBeNull()
    expect(clashingMasterId(null)).toBeNull()
    expect(clashingMasterId('M-BUPA')).toBeNull()
  })
  it('reads the whole clash: names and shared stores', () => {
    const data = { masterId: 'M-NEW', clashingMasterId: 'M-BUPA', clashingNameEn: 'Bupa', clashingNameAr: 'بوبا', sharedStores: ['P019', 'P020', 7] }
    expect(scopeClash(data)).toEqual({ clashingMasterId: 'M-BUPA', clashingNameEn: 'Bupa', clashingNameAr: 'بوبا', sharedStores: ['P019', 'P020'] })
    expect(scopeClash({ clashingMasterId: 'M-X' })).toEqual({ clashingMasterId: 'M-X', clashingNameEn: '', clashingNameAr: '', sharedStores: [] })
    expect(scopeClash({ badStoreCodes: ['P999'] })).toBeNull()
  })
  it('an unknown-store refusal (IDF-00016) names the bad codes', () => {
    expect(badStoreCodes({ badStoreCodes: ['P999', '', 3, 'Q1'] })).toEqual(['P999', 'Q1'])
    expect(badStoreCodes(null)).toEqual([])
  })
})
