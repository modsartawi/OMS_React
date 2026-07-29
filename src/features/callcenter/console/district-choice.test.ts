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
import { cityChoices, districtChoices } from './district-choice'

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

  it('matches on the CITY name too, even though the form now asks the city first', () => {
    // The form narrows by `cityCode` before this box is drawn, so city matching
    // is usually redundant there. It is KEPT rather than removed: the narrowing
    // is the caller's, and an unnarrowed call (`cityCode` null) is still a
    // supported shape of this function — see the city-scoping block below.
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

// ═══ city first (owner-stated 2026-07-29) ═══════════════════════════════════
//
// "I need the city first then district (Dammam - <district>) — the operator
// usually asks the caller what city you are in first."
//
// The estate is ~1,674 districts across 34 cities (query-verified on the dev
// POS_Server), which is the whole argument: the city step is the one question
// that turns an unusable list into a short one, and it is the question the call
// opens with anyway.

describe('cityChoices — folding the district list up', () => {
  const ALL = [
    district({ districtCode: 'D-1', cityCode: '0041', cityNameEn: 'Dammam', districtNameEn: 'Al Faisaliyah' }),
    district({ districtCode: 'D-2', cityCode: '0041', cityNameEn: 'Dammam', districtNameEn: 'Al Adamah' }),
    district({ districtCode: 'R-114', cityCode: '0021', cityNameEn: 'Riyadh', districtNameEn: 'Al Malqa' }),
  ]

  it('answers one row per city, not one per district', () => {
    const { rows } = cityChoices(ALL, {})
    expect(rows.map((c) => c.cityCode)).toEqual(['0041', '0021'])
    expect(rows.map((c) => c.cityName)).toEqual(['Dammam', 'Riyadh'])
  })

  it('counts only the districts something actually delivers to', () => {
    const { rows } = cityChoices(
      [...ALL, district({ districtCode: 'D-3', cityCode: '0041', storeCode: '', tempStoreCode: '' })],
      {},
    )
    const dammam = rows.find((c) => c.cityCode === '0041')!
    // Three districts in Dammam, two of them deliverable — the count must be the
    // second number. A count of "3 districts" over a city where one cannot be
    // picked is the console overstating what it can do for the caller.
    expect(dammam.deliverableDistricts).toBe(2)
    expect(dammam.deliverable).toBe(true)
  })

  it('🚩 greys a city no store delivers to ANYWHERE, rather than hiding it', () => {
    const { rows } = cityChoices(
      [district({ districtCode: 'X-1', cityCode: '0099', cityNameEn: 'Hail', storeCode: '', tempStoreCode: '' })],
      {},
    )
    // Same rule as a district (§2.3): visible and unpickable. And it is answered
    // HERE rather than after the agent has hunted through the city's districts.
    expect(rows[0]).toMatchObject({ cityName: 'Hail', deliverable: false, deliverableDistricts: 0 })
  })

  it('never lets a store code out of the module either', () => {
    const projected = JSON.stringify(
      cityChoices([district({ storeCode: '1101', tempStoreCode: '1102', insuranceStoreCode: '9901' })], {}),
    )
    // The negative property this whole file exists for, restated for the new
    // step: asking WHETHER is allowed, asking WHICH is not (179 ruling 4).
    for (const store of ['1101', '1102', '9901']) expect(projected).not.toContain(store)
  })

  it('matches on the city name, and falls back to Arabic when English is blank', () => {
    expect(cityChoices(ALL, { query: 'damm' }).rows.map((c) => c.cityCode)).toEqual(['0041'])
    const arabicOnly = cityChoices([district({ cityCode: '0051', cityNameEn: '', cityNameAr: 'مكة' })], {})
    expect(arabicOnly.rows[0].cityName).toBe('مكة')
  })

  it('pins the chosen city above the rest, exactly as the district step does', () => {
    const { pinned, rows } = cityChoices(ALL, { query: 'riy', currentCityCode: '0041' })
    expect(pinned).toMatchObject({ cityCode: '0041', isCurrent: true })
    expect(rows.map((c) => c.cityCode)).toEqual(['0021'])
  })

  it('answers empty rather than throwing while the lookup is in flight', () => {
    expect(cityChoices(undefined, {})).toEqual({ pinned: null, rows: [], truncated: false, total: 0 })
  })

  it('drops rows with no city code — a city that cannot be picked is not offered', () => {
    expect(cityChoices([district({ cityCode: '  ' })], {}).rows).toEqual([])
  })
})

describe('districtChoices — scoped to the chosen city', () => {
  const ALL = [
    district({ districtCode: 'D-1', cityCode: '0041', cityNameEn: 'Dammam', districtNameEn: 'Al Faisaliyah' }),
    district({ districtCode: 'R-1', cityCode: '0021', cityNameEn: 'Riyadh', districtNameEn: 'Al Faisaliyah' }),
  ]

  it('🚩 shows only the named city, even for a name TWO cities share', () => {
    // Al Faisaliyah exists in both. Under the old one-box search the agent saw
    // two identical-looking rows and had to read the city off the end of each to
    // tell them apart — and picking the wrong one silently routes the order to
    // another city's store. The city step makes that ambiguity unreachable.
    const { rows } = districtChoices(ALL, { query: 'faisaliyah', cityCode: '0041' })
    expect(rows.map((r) => r.districtCode)).toEqual(['D-1'])
  })

  it('falls back to the whole estate when no city is named', () => {
    // Null and blank are the same fact — no city chosen yet — and neither may be
    // read as "a city whose code is empty", which would match nothing at all.
    for (const cityCode of [null, undefined, '']) {
      expect(districtChoices(ALL, { query: 'faisaliyah', cityCode }).rows).toHaveLength(2)
    }
  })

  it('leaves the pin alone: a pick outside the city is still shown, not dropped', () => {
    const { pinned } = districtChoices(ALL, { currentDistrictCode: 'R-1', cityCode: '0041' })
    // The rule this file already holds — "a search that would hide the current
    // pick must not clear it" — and the city step is one more thing that could
    // hide it. An address settled in Riyadh must not read as districtless the
    // moment the agent opens the city step to change it.
    expect(pinned?.districtCode).toBe('R-1')
  })
})
