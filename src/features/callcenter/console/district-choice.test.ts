/**
 * The district picker's one derivation — **is this district deliverable at all**
 * — asserted at its edge: wire rows in, pickable choices out.
 *
 * 🚩 The property this suite exists for is a NEGATIVE one: no store code may
 * leave the module. `address-book.ts` holds the standing rule that the console
 * never derives a store, and 179 ruled that asking *whether there is a store* is
 * allowed where asking *which* is not. The last case in the first block is what
 * keeps that literal — it reads the whole projection back as text and fails if
 * either store code is anywhere in it.
 */
import { describe, expect, it } from 'vitest'
import type { SdDistrictModel } from '@/core/models/lookups'
import { districtChoices } from './district-choice'

const district = (over: Partial<SdDistrictModel> = {}): SdDistrictModel => ({
  districtCode: 'R-114',
  cityCode: '0021',
  cityNameAr: 'الرياض',
  cityNameEn: 'Riyadh',
  magentoCityEn: '',
  magentoCityAr: '',
  districtNameAr: 'الملقا',
  districtNameEn: 'Al Malqa',
  storeCode: '1101',
  insuranceStoreCode: '9901',
  tempStoreCode: '',
  createdOn: '',
  createdBy: '',
  updatedOn: '',
  updatedBy: '',
  latitude: 0,
  longitude: 0,
  ...over,
})

describe('districtChoices — deliverability', () => {
  it('is deliverable on a normal store code', () => {
    const { rows } = districtChoices([district()], {})
    expect(rows[0].deliverable).toBe(true)
  })

  it('is deliverable on the operational override alone', () => {
    const { rows } = districtChoices([district({ storeCode: '', tempStoreCode: '1102' })], {})
    expect(rows[0].deliverable).toBe(true)
  })

  it('is NOT deliverable when neither code carries a store', () => {
    const { rows } = districtChoices([district({ storeCode: '  ', tempStoreCode: '' })], {})
    expect(rows[0].deliverable).toBe(false)
  })

  it('never lets a store code out of the module', () => {
    const projected = JSON.stringify(
      districtChoices(
        [district({ storeCode: '1101', tempStoreCode: '1102', insuranceStoreCode: '9901' })],
        {},
      ),
    )
    expect(projected).not.toContain('1101')
    expect(projected).not.toContain('1102')
    expect(projected).not.toContain('9901')
  })
})

describe('districtChoices — the one search box', () => {
  const ALL = [
    district({ districtCode: 'R-114', districtNameEn: 'Al Malqa', districtNameAr: 'الملقا' }),
    district({
      districtCode: 'J-201',
      cityCode: '0031',
      cityNameEn: 'Jeddah',
      cityNameAr: 'جدة',
      districtNameEn: 'Al Rawdah',
      districtNameAr: 'الروضة',
    }),
  ]

  it('matches on the district name, case-insensitively', () => {
    const { rows } = districtChoices(ALL, { query: 'malqa' })
    expect(rows.map((r) => r.districtCode)).toEqual(['R-114'])
  })

  it('matches on the CITY name too — one box, not a cascade', () => {
    const { rows } = districtChoices(ALL, { query: 'jed' })
    expect(rows.map((r) => r.districtCode)).toEqual(['J-201'])
  })

  it('matches Arabic as typed — no folding, CC2’s own limitation inherited', () => {
    expect(districtChoices(ALL, { query: 'الملقا' }).rows.map((r) => r.districtCode)).toEqual([
      'R-114',
    ])
    // A hamza/alef variant does NOT match, exactly as OrdinalIgnoreCase does not
    // in CC2. Asserted so the limitation is inherited knowingly (179 ruling 4).
    expect(districtChoices(ALL, { query: 'ألملقا' }).rows).toEqual([])
  })

  it('carries the city with the district, so one pick commits both', () => {
    const [row] = districtChoices(ALL, { query: 'rawdah' }).rows
    expect(row).toMatchObject({ cityCode: '0031', cityName: 'Jeddah', districtName: 'Al Rawdah' })
  })

  it('answers the whole list for an empty box', () => {
    expect(districtChoices(ALL, { query: '   ' }).rows).toHaveLength(2)
  })
})

describe('districtChoices — the current pick', () => {
  const ALL = [
    district({ districtCode: 'R-114', districtNameEn: 'Al Malqa' }),
    district({ districtCode: 'J-201', districtNameEn: 'Al Rawdah', cityNameEn: 'Jeddah' }),
  ]

  it('pins the current pick above the results, and never inside them', () => {
    const { pinned, rows } = districtChoices(ALL, { query: 'rawdah', currentDistrictCode: 'R-114' })
    expect(pinned?.districtCode).toBe('R-114')
    expect(pinned?.isCurrent).toBe(true)
    expect(rows.map((r) => r.districtCode)).toEqual(['J-201'])
  })

  it('keeps the pin even when the search would hide it', () => {
    const { pinned } = districtChoices(ALL, { query: 'nothing matches this', currentDistrictCode: 'R-114' })
    expect(pinned?.districtCode).toBe('R-114')
  })

  it('has no pin when nothing is picked yet', () => {
    expect(districtChoices(ALL, {}).pinned).toBeNull()
  })

  it('has no pin for a code the list does not carry', () => {
    expect(districtChoices(ALL, { currentDistrictCode: 'X-999' }).pinned).toBeNull()
  })
})

describe('districtChoices — the ~1,000-row list', () => {
  const MANY = Array.from({ length: 60 }, (_, i) =>
    district({ districtCode: `D-${i}`, districtNameEn: `District ${i}` }),
  )

  it('caps what it hands the eye and says the list was cut', () => {
    const { rows, truncated, total } = districtChoices(MANY, { query: '', limit: 25 })
    expect(rows).toHaveLength(25)
    expect(truncated).toBe(true)
    expect(total).toBe(60)
  })

  it('says nothing was cut when the whole match fits', () => {
    const { truncated, total } = districtChoices(MANY, { query: 'District 41', limit: 25 })
    expect(truncated).toBe(false)
    expect(total).toBe(1)
  })
})

describe('districtChoices — a list that is not there', () => {
  it('answers empty rather than throwing while the lookup is in flight', () => {
    expect(districtChoices(undefined, { query: 'malqa' })).toEqual({
      pinned: null,
      rows: [],
      truncated: false,
      total: 0,
    })
  })

  it('drops a row with no district code — unpickable by construction', () => {
    expect(districtChoices([district({ districtCode: '' })], {}).rows).toEqual([])
  })
})
