import { describe, expect, it } from 'vitest'
import type { SdCityModel } from '@/core/models/lookups'
import { citiesQuery, districtsQuery, lastChange, selectedCityCode } from './geography'

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
