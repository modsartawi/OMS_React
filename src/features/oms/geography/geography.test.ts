import { describe, expect, it } from 'vitest'
import type { SdCityModel } from '@/core/models/lookups'
import { parseImport, sendableLines } from '@/core/import/parse-import'
import {
  CITY_IMPORT_COLUMNS,
  DISTRICT_IMPORT_COLUMNS,
  GEOGRAPHY_LISTS_KEY,
  citiesQuery,
  districtsQuery,
  geographyImportBody,
  lastChange,
  selectedCityCode,
} from './geography'

const UNSET = '0001-01-01T00:00:00'

const city = (over: Partial<SdCityModel> = {}): SdCityModel => ({
  cityCode: 'RUH',
  cityNameEn: 'Riyadh',
  cityNameAr: 'الرياض',
  createdOn: '2024-01-02T08:00:00',
  createdBy: 'seed',
  updatedOn: UNSET,
  updatedBy: '',
  ...over,
})

describe('districtsQuery — the lower grid reads the selected city only (ticket 436)', () => {
  it('asks nothing until a city is selected', () => {
    expect(districtsQuery(null).enabled).toBe(false)
  })

  it('is keyed by the city code, so two cities are two cache entries', () => {
    const ruh = districtsQuery('RUH')
    const jed = districtsQuery('JED')
    expect(ruh.enabled).toBe(true)
    expect(ruh.queryKey).toEqual(['geography', 'districts', 'RUH'])
    expect(jed.queryKey).toEqual(['geography', 'districts', 'JED'])
  })

  it('sits under the geography key with the cities, so one invalidation reloads both lists', () => {
    expect(citiesQuery().queryKey).toEqual(['geography', 'cities'])
    expect(districtsQuery('RUH').queryKey.slice(0, 1)).toEqual(citiesQuery().queryKey.slice(0, 1))
  })
})

describe('selectedCityCode — a selection becomes a city code, or nothing', () => {
  it('takes the selected row’s code, trimmed', () => {
    expect(selectedCityCode(city({ cityCode: ' RUH ' }))).toBe('RUH')
  })

  it('no row, or a row with a blank code, selects no city', () => {
    expect(selectedCityCode(undefined)).toBeNull()
    expect(selectedCityCode(city({ cityCode: '  ' }))).toBeNull()
  })
})

describe('lastChange — who changed a row last, and when', () => {
  it('the update when there was one', () => {
    expect(lastChange(city({ updatedOn: '2026-09-01T10:30:00', updatedBy: 'hq.lead' }))).toEqual({
      by: 'hq.lead',
      on: '2026-09-01T10:30:00',
    })
  })

  it('the creation when the row was never updated (the .NET unset date, or none)', () => {
    expect(lastChange(city())).toEqual({ by: 'seed', on: '2024-01-02T08:00:00' })
    expect(lastChange(city({ updatedOn: '' }))).toEqual({ by: 'seed', on: '2024-01-02T08:00:00' })
  })

  it('nothing when neither is set', () => {
    expect(lastChange(city({ createdOn: UNSET, createdBy: '' }))).toEqual({ by: '', on: null })
  })
})

describe('geographyImportBody — what the imports send (ticket 437, spec 430 D6)', () => {
  it('sends a city line with its English name before its Arabic one, and isDelete', () => {
    const body = geographyImportBody(sendableLines(parseImport('RUH\tRiyadh\tالرياض\nJED\tJeddah\tجدة\tX', CITY_IMPORT_COLUMNS))!)
    expect(body).toEqual({
      lines: [
        { cityCode: 'RUH', cityNameEn: 'Riyadh', cityNameAr: 'الرياض', isDelete: false },
        { cityCode: 'JED', cityNameEn: 'Jeddah', cityNameAr: 'جدة', isDelete: true },
      ],
    })
    expect(Object.keys(body.lines[0])).not.toContain('isDeleted')
  })

  it("sends a district line in WPF's field names", () => {
    const body = geographyImportBody(
      sendableLines(parseImport('RUH-01\tRUH\tAl Olaya\tالعليا\tRiyadh\tالرياض\tP001\tP050\tP002\tx', DISTRICT_IMPORT_COLUMNS))!,
    )
    expect(body.lines).toEqual([
      {
        districtCode: 'RUH-01',
        cityCode: 'RUH',
        districtNameEn: 'Al Olaya',
        districtNameAr: 'العليا',
        magentoCityEn: 'Riyadh',
        magentoCityAr: 'الرياض',
        storeCode: 'P001',
        insuranceStoreCode: 'P050',
        tempStoreCode: 'P002',
        isDelete: true,
      },
    ])
  })

  it('reloads both lists under one key', () => {
    expect(citiesQuery().queryKey.slice(0, 1)).toEqual([...GEOGRAPHY_LISTS_KEY])
    expect(districtsQuery('RUH').queryKey.slice(0, 1)).toEqual([...GEOGRAPHY_LISTS_KEY])
  })
})
