import type { SdCityModel } from '@/core/models/lookups'
import { isBlankDate } from '@/core/util/date-format'
import { geographyApi } from './api'

// Cities & districts (ticket 436, spec 430 D6/D13): what the screen reads and when. The upper grid
// loads every city on open (D16); the lower one loads the selected city's districts, and nothing
// until a city is selected.

/** The screen's root key: one invalidation reloads both lists (the import, ticket 437). */
const GEOGRAPHY_KEY = 'geography'

/** Every city, on open. */
export function citiesQuery() {
  return {
    queryKey: [GEOGRAPHY_KEY, 'cities'] as const,
    queryFn: () => geographyApi.cities(),
    retry: false,
  }
}

/**
 * The selected city's districts — keyed by its code, so going back to a city reads its cached list,
 * and disabled while no city is selected, so the lower grid asks nothing on open.
 */
export function districtsQuery(cityCode: string | null) {
  return {
    queryKey: [GEOGRAPHY_KEY, 'districts', cityCode ?? ''] as const,
    queryFn: () => geographyApi.districts(cityCode ?? ''),
    enabled: cityCode !== null,
    retry: false,
  }
}

/** The city a grid selection stands for: its code trimmed, or none for no row or a blank code. */
export function selectedCityCode(row: Pick<SdCityModel, 'cityCode'> | null | undefined): string | null {
  const code = row?.cityCode?.trim()
  return code ? code : null
}

/** The audit fields both rows carry. */
type Audited = Pick<SdCityModel, 'createdOn' | 'createdBy' | 'updatedOn' | 'updatedBy'>

/**
 * Who changed a row last, and when: its update when it had one, else its creation. An unset time
 * (empty, or the .NET `0001-01-01`) is no change at all.
 */
export function lastChange(row: Audited): { by: string; on: string | null } {
  if (isSet(row.updatedOn)) return { by: row.updatedBy ?? '', on: row.updatedOn }
  if (isSet(row.createdOn)) return { by: row.createdBy ?? '', on: row.createdOn }
  return { by: '', on: null }
}

function isSet(value: string | null | undefined): value is string {
  return !!value && !isBlankDate(new Date(value))
}
