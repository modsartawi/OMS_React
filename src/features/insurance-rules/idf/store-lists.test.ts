/**
 * Ticket 620 (reconciled by 628) — a store list's stores are edited as one set and saved whole (`PUT …/{id}/stores
 * { storeCodes }`): typed codes are split on commas and spaces, upper-cased and de-duplicated; removing a code drops
 * it; the set sent is exactly the set on screen. A list is `{ storeListId, code, nameEn, nameAr, isPilotList,
 * storeCodes, addedTime }` (3162); a new one needs a plain-ASCII code (≤ 26, no comma) and both names.
 */
import { describe, expect, it } from 'vitest'
import { addStores, createListProblems, removeStore, sameStoreSet, storeListName, storeSetBody } from './store-lists'

describe('store set edit', () => {
  it('adds, removes and de-duplicates store codes — the set sent equals the visible set', () => {
    const start = ['P001', 'P002']
    const added = addStores(start, ' p003, P001  p004,,P003 ')
    expect(added).toEqual(['P001', 'P002', 'P003', 'P004'])
    const removed = removeStore(added, 'P002')
    expect(removed).toEqual(['P001', 'P003', 'P004'])
    expect(storeSetBody(removed)).toEqual({ storeCodes: ['P001', 'P003', 'P004'] })
    expect(start).toEqual(['P001', 'P002'])
  })
  it('adding nothing but separators leaves the set as it was', () => {
    expect(addStores(['P001'], ' , ;\n')).toEqual(['P001'])
  })
  it('the set is unchanged whatever its order: removing and re-adding a code is not an edit', () => {
    const saved = ['P001', 'P002', 'P003']
    const reAdded = addStores(removeStore(saved, 'P001'), 'p001')
    expect(reAdded).toEqual(['P002', 'P003', 'P001'])
    expect(sameStoreSet(reAdded, saved)).toBe(true)
    expect(sameStoreSet(removeStore(saved, 'P002'), saved)).toBe(false)
    expect(sameStoreSet(['P001', 'P004', 'P003'], saved)).toBe(false)
    expect(sameStoreSet([], [])).toBe(true)
  })
})

describe('a store list reads its name in the reader\'s language and is created with a code and both names', () => {
  const list = { code: 'OPS', nameEn: 'Operation pharmacies', nameAr: 'صيدليات التشغيل' }
  it('Arabic for an Arabic reader, English otherwise, the code when both names are blank', () => {
    expect(storeListName(list, 'ar')).toBe('صيدليات التشغيل')
    expect(storeListName(list, 'en')).toBe('Operation pharmacies')
    expect(storeListName({ ...list, nameAr: '' }, 'ar-SA')).toBe('Operation pharmacies')
    expect(storeListName({ ...list, nameEn: '', nameAr: '' }, 'en')).toBe('OPS')
  })
  it('a code of plain ASCII (no spaces, no commas, at most 26) and both names', () => {
    expect(createListProblems(list)).toEqual({})
    expect(createListProblems({ code: '', nameEn: '', nameAr: ' ' })).toEqual({ code: 'codeRequired', nameEn: 'nameRequired', nameAr: 'nameRequired' })
    expect(createListProblems({ ...list, code: 'OPS EAST' }).code).toBe('codeAscii')
    expect(createListProblems({ ...list, code: 'OPS,EAST' }).code).toBe('codeAscii')
    expect(createListProblems({ ...list, code: 'صيدلية' }).code).toBe('codeAscii')
    expect(createListProblems({ ...list, code: 'X'.repeat(27) }).code).toBe('codeTooLong')
    expect(createListProblems({ ...list, code: 'OPS-EAST_2' })).toEqual({})
  })
})
