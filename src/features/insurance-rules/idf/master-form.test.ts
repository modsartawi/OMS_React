/**
 * Ticket 621 — the create / edit master form. Thresholds read "hard above N, reminder above M", default to 4 and 1,
 * are whole numbers, and a reminder threshold above the hard one is refused before anything is sent. An insurer
 * master needs a payer (a store list optional), a store master a store list; both names are required.
 */
import { describe, expect, it } from 'vitest'
import { clashingMasterId, masterBody, masterFormProblems, newMasterForm } from './master-form'

describe('master form defaults thresholds to 4 and 1 and refuses reminder above hard', () => {
  it('a new form starts at hard 4, reminder 1', () => {
    expect([newMasterForm().hard, newMasterForm().reminder]).toEqual(['4', '1'])
  })
  it('a reminder threshold above the hard one is refused on the reminder', () => {
    const f = { ...newMasterForm(), payerCode: 'BUPA', nameEn: 'Bupa', nameAr: 'بوبا', hard: '3', reminder: '5' }
    expect(masterFormProblems(f)).toEqual({ reminder: 'reminderAboveHard' })
  })
  it('equal thresholds and a zero reminder are allowed', () => {
    const f = { ...newMasterForm(), payerCode: 'BUPA', nameEn: 'Bupa', nameAr: 'بوبا', hard: '3', reminder: '3' }
    expect(masterFormProblems(f)).toEqual({})
    expect(masterFormProblems({ ...f, reminder: '0' })).toEqual({})
  })
  it('thresholds must be whole numbers of 0 or more', () => {
    const f = { ...newMasterForm(), payerCode: 'BUPA', nameEn: 'Bupa', nameAr: 'بوبا' }
    expect(masterFormProblems({ ...f, hard: '2.5', reminder: '' })).toEqual({ hard: 'wholeNumber', reminder: 'wholeNumber' })
    expect(masterFormProblems({ ...f, hard: '-1' })).toEqual({ hard: 'wholeNumber' })
  })
  it('the body sends the thresholds as numbers', () => {
    const f = { ...newMasterForm(), payerCode: ' bupa ', nameEn: ' Bupa ', nameAr: 'بوبا' }
    expect(masterBody(f)).toEqual({ kind: 'insurer', payerCode: 'BUPA', storeListId: null, nameEn: 'Bupa', nameAr: 'بوبا', hardThreshold: 4, reminderThreshold: 1 })
  })
})

describe('master form requires a payer for insurer and a store list for store', () => {
  it('an empty insurer form asks for a payer and both names, not a store list', () => {
    expect(masterFormProblems(newMasterForm('insurer'))).toEqual({ payerCode: 'payerRequired', nameEn: 'nameRequired', nameAr: 'nameRequired' })
  })
  it('an empty store form asks for a store list and both names, not a payer', () => {
    expect(masterFormProblems(newMasterForm('store'))).toEqual({ storeListId: 'storeListRequired', nameEn: 'nameRequired', nameAr: 'nameRequired' })
  })
  it('an insurer master scoped to a store list sends both; a store master never sends a payer', () => {
    const scoped = { ...newMasterForm('insurer'), payerCode: 'TAWUNIYA', storeListId: 'SL-PILOT', nameEn: 'T', nameAr: 'ت' }
    expect([masterBody(scoped).payerCode, masterBody(scoped).storeListId]).toEqual(['TAWUNIYA', 'SL-PILOT'])
    const store = { ...newMasterForm('store'), payerCode: 'LEFTOVER', storeListId: 'SL-OPS', nameEn: 'O', nameAr: 'ع' }
    expect(masterFormProblems(store)).toEqual({})
    expect([masterBody(store).payerCode, masterBody(store).storeListId]).toEqual([null, 'SL-OPS'])
  })
  it('blank-only names count as missing', () => {
    const f = { ...newMasterForm('insurer'), payerCode: 'BUPA', nameEn: '   ', nameAr: 'بوبا' }
    expect(masterFormProblems(f)).toEqual({ nameEn: 'nameRequired' })
  })
})

describe('an overlap refusal names the clashing master', () => {
  it('reads the clashing master id off the refusal data, defensively', () => {
    expect(clashingMasterId({ clashingMasterId: 'M-BUPA' })).toBe('M-BUPA')
    expect(clashingMasterId({ clashingMasterId: '' })).toBeNull()
    expect(clashingMasterId(null)).toBeNull()
    expect(clashingMasterId('M-BUPA')).toBeNull()
  })
})
