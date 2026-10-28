/**
 * Ticket 643 — a master's items (BackOffice spec 3185, door 3187). The items address (`?q&idf&page`, shared with
 * 647's General page) plus the master page's `?version` (absent = the live one); the door's params; the version shown.
 */
import { describe, expect, it } from 'vitest'
import {
  entriesVersionId,
  itemDescription,
  itemsDoorParams,
  pickVersion,
  readMasterItemsQuery,
  typedItemsFilter,
  withItemsFilter,
  writeMasterItemsQuery,
} from './items'

const read = (qs: string) => readMasterItemsQuery(new URLSearchParams(qs))

describe('entries query keeps search, group and page, and resets page on a new filter', () => {
  it('defaults_theLiveVersion_noSearch_noGroup_page1', () => {
    expect(read('')).toEqual({ version: '', q: '', idf: '', page: 1 })
  })

  it('readsEveryField_trimsTheTypedOnes_andIgnoresABadPage', () => {
    expect(read('version=V-7&q=%20panadol%20&idf=%20IDF-PARA&page=3')).toEqual({ version: 'V-7', q: 'panadol', idf: 'IDF-PARA', page: 3 })
    expect(read('page=0')).toMatchObject({ page: 1 })
    expect(read('page=2.5')).toMatchObject({ page: 1 })
  })

  it('writesOnlyWhatDiffersFromTheDefaults_soTheBareAddressStaysBare', () => {
    expect(writeMasterItemsQuery(read('')).toString()).toBe('')
    expect(writeMasterItemsQuery({ version: 'V-2', q: '1002', idf: 'IDF-IBU', page: 2 }).toString()).toBe('version=V-2&q=1002&idf=IDF-IBU&page=2')
  })

  it('aNewSearchOrGroupGoesBackToPage1_andKeepsTheOtherFilterAndTheVersion', () => {
    const q = { version: 'V-7', q: 'adol', idf: 'IDF-PARA', page: 4 }
    expect(withItemsFilter(q, { q: 'brufen' })).toEqual({ version: 'V-7', q: 'brufen', idf: 'IDF-PARA', page: 1 })
    expect(withItemsFilter(q, { idf: '' })).toEqual({ version: 'V-7', q: 'adol', idf: '', page: 1 })
  })

  it('aTypedSearchOrGroup_appliesOnlyWhenItChanged_soLeavingTheBoxKeepsThePage', () => {
    const q = { q: 'adol', idf: '', page: 3 }
    expect(typedItemsFilter(q, 'q', ' adol ')).toBeNull()
    expect(typedItemsFilter(q, 'idf', '  ')).toBeNull()
    expect(typedItemsFilter(q, 'q', 'Brufen ')).toEqual({ q: 'Brufen' })
    expect(typedItemsFilter(q, 'idf', ' IDF-IBU')).toEqual({ idf: 'IDF-IBU' })
  })

  it('theDoorTakesSearchGroupAndPage_blanksLeftForBuildQueryToDrop', () => {
    expect(itemsDoorParams({ q: 'panadol', idf: 'IDF-PARA', page: 2 })).toEqual({ search: 'panadol', idf: 'IDF-PARA', page: '2' })
    expect(itemsDoorParams({ q: '', idf: '', page: 1 })).toEqual({ search: '', idf: '', page: '1' })
  })
})

describe('the version shown', () => {
  it('noVersionInTheAddress_isTheLiveOne_orNoneWhenTheMasterHasNoLiveVersion', () => {
    expect(entriesVersionId(read(''), 'V-11')).toBe('V-11')
    expect(entriesVersionId(read(''), null)).toBeNull()
    expect(entriesVersionId(read('version=V-2'), 'V-11')).toBe('V-2')
    expect(entriesVersionId(read('version=V-2'), null)).toBe('V-2')
  })

  it('pickingAVersion_keepsTheFilters_goesToPage1_andPickingTheLiveOneClearsItFromTheAddress', () => {
    const q = { version: '', q: 'adol', idf: 'IDF-PARA', page: 3 }
    expect(pickVersion(q, 'V-7', 'V-11')).toEqual({ version: 'V-7', q: 'adol', idf: 'IDF-PARA', page: 1 })
    expect(pickVersion({ ...q, version: 'V-7' }, 'V-11', 'V-11')).toEqual({ version: '', q: 'adol', idf: 'IDF-PARA', page: 1 })
  })
})

describe('an item reads in the reader’s language', () => {
  const row = { itemNumber: '100200', descriptionEn: 'Panadol 500 mg', descriptionAr: 'بنادول ٥٠٠ مجم', idfNumber: 'IDF-PARA', priority: 1 }
  it('arabicWhenTheReaderReadsArabic_englishOtherwise_eitherWhenTheOtherIsBlank', () => {
    expect(itemDescription(row, 'ar')).toBe('بنادول ٥٠٠ مجم')
    expect(itemDescription(row, 'en')).toBe('Panadol 500 mg')
    expect(itemDescription({ ...row, descriptionAr: '' }, 'ar')).toBe('Panadol 500 mg')
    expect(itemDescription({ ...row, descriptionEn: null }, 'en')).toBe('بنادول ٥٠٠ مجم')
  })
})
