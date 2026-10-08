import type { SdCityModel } from '@/core/models/lookups'
import type { ImportOkLine } from '@/core/import/parse-import'
import { isBlankDate } from '@/core/util/date-format'
import { geographyApi } from './api'

// Cities & districts (ticket 436, spec 430 D6/D13): what the screen reads and when. The upper grid
// loads every city on open (D16); the lower one loads the selected city's districts, and nothing
// until a city is selected.

/** The screen's root key: one invalidation reloads both lists (the import, ticket 437). */
const GEOGRAPHY_KEY = 'geography'

/** Both lists — every city and every district list read so far — for the import's reload. */
export const GEOGRAPHY_LISTS_KEY = [GEOGRAPHY_KEY] as const

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

// ----- the imports (ticket 437, spec 430 D6/D14) ------------------------------------------------

/** WPF's city file: code, then the ENGLISH name, then the Arabic name (`SdCityImportController`). */
export const CITY_IMPORT_COLUMNS = ['cityCode', 'cityNameEn', 'cityNameAr'] as const

/** WPF's district file, in `SdDistrictImportController`'s order. */
export const DISTRICT_IMPORT_COLUMNS = [
  'districtCode',
  'cityCode',
  'districtNameEn',
  'districtNameAr',
  'magentoCityEn',
  'magentoCityAr',
  'storeCode',
  'insuranceStoreCode',
  'tempStoreCode',
] as const

export type ImportKind = 'cities' | 'districts'

/** Each list's import columns. The keys are the body's field names (WPF's update-request lines). */
export const IMPORT_COLUMNS = {
  cities: CITY_IMPORT_COLUMNS,
  districts: DISTRICT_IMPORT_COLUMNS,
} as const satisfies Record<ImportKind, readonly string[]>

/** A line of the import body: the file's fields, plus WPF's `isDelete` (not `isDeleted`). */
export type GeographyImportLine<K extends string> = Record<K, string> & { isDelete: boolean }

/**
 * The body of `POST SdDocumentWeb/Cities/Import` or `Districts/Import`: `{ lines }`, every line in
 * file order with `isDelete`. The lines are the core dialog's `sendableLines` — all of them, none in
 * error — so the server's 1-based `line` stays the preview's.
 */
export function geographyImportBody<K extends string>(lines: readonly ImportOkLine<K>[]): { lines: GeographyImportLine<K>[] } {
  return { lines: lines.map((l) => ({ ...l.fields, isDelete: l.action === 'delete' })) }
}
