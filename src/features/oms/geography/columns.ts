import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { SdCityModel, SdDistrictModel } from '@/core/models/lookups'
import { formatDateTime } from '@/core/util/date-format'
import type { ImportLine } from '@/core/import/parse-import'
import { lastChange, type IMPORT_COLUMNS, type ImportKind } from './geography'

// The two Cities & districts grids (ticket 436, spec 430 D13/D15): WPF's columns, English before
// Arabic as WPF draws them, then the last change as one "by" and one "on".
//
// Every cell is isolated whole by the core grid base (`<bdi>`, dir auto): a name in either script
// runs its own way, and a code, a store or a coordinate — digits and Latin — runs LTR. No column
// has its own renderer, so the base is the one isolate. Labels are `valueGetter`s/`valueFormatter`s,
// so the quick filter, sort, Ctrl+C and the export all read what is drawn.

const CODE = 'font-mono text-[12px]'
const when = <T,>({ value }: ValueFormatterParams<T, string | null>) => formatDateTime(value)

/** The last change, as the trailing pair of columns both grids share. */
function changeColumns<T extends SdCityModel | SdDistrictModel>(t: TFunction): ColDef<T>[] {
  return [
    { colId: 'changedBy', headerName: t('columns.changedBy'), width: 130, valueGetter: ({ data }) => (data ? lastChange(data).by : '') },
    {
      colId: 'changedOn',
      headerName: t('columns.changedOn'),
      width: 145,
      valueGetter: ({ data }) => (data ? lastChange(data).on : null),
      valueFormatter: when,
      // The quick filter matches the day as drawn, not the ISO value behind it.
      getQuickFilterText: ({ value }) => formatDateTime(value),
    },
  ]
}

/** The upper grid: every city. */
export function cityColumns(t: TFunction): ColDef<SdCityModel>[] {
  return [
    { field: 'cityCode', headerName: t('columns.cityCode'), width: 110, cellClass: CODE },
    { field: 'cityNameEn', headerName: t('columns.nameEn'), width: 200 },
    { field: 'cityNameAr', headerName: t('columns.nameAr'), width: 200 },
    ...changeColumns<SdCityModel>(t),
  ]
}

/** The lower grid: the selected city's districts. */
export function districtColumns(t: TFunction): ColDef<SdDistrictModel>[] {
  const coordinate = { width: 120, type: 'numericColumn', cellClass: 'text-end tabular-nums' } satisfies ColDef<SdDistrictModel>
  return [
    { field: 'districtCode', headerName: t('columns.districtCode'), width: 120, cellClass: CODE },
    { field: 'districtNameEn', headerName: t('columns.nameEn'), width: 190 },
    { field: 'districtNameAr', headerName: t('columns.nameAr'), width: 190 },
    { field: 'magentoCityEn', headerName: t('columns.magentoCityEn'), width: 160 },
    { field: 'magentoCityAr', headerName: t('columns.magentoCityAr'), width: 160 },
    { field: 'storeCode', headerName: t('columns.store'), width: 95, cellClass: CODE },
    { field: 'insuranceStoreCode', headerName: t('columns.insuranceStore'), width: 130, cellClass: CODE },
    { field: 'tempStoreCode', headerName: t('columns.tempStore'), width: 130, cellClass: CODE },
    { field: 'latitude', headerName: t('columns.latitude'), ...coordinate },
    { field: 'longitude', headerName: t('columns.longitude'), ...coordinate },
    ...changeColumns<SdDistrictModel>(t),
  ]
}

/** Identities the export writes as text, so Excel never reshapes a code that looks like a number. */
export const EXPORT_AS_TEXT: ReadonlySet<string> = new Set([
  'cityCode',
  'districtCode',
  'storeCode',
  'insuranceStoreCode',
  'tempStoreCode',
])

// ----- the import preview (ticket 437, spec 430 D14) ---------------------------------------------

/** Each import field's header: the list's own column label, so the preview reads like the grid. */
const IMPORT_HEADER: Record<(typeof IMPORT_COLUMNS)[ImportKind][number], string> = {
  cityCode: 'cityCode',
  cityNameEn: 'nameEn',
  cityNameAr: 'nameAr',
  districtCode: 'districtCode',
  districtNameEn: 'nameEn',
  districtNameAr: 'nameAr',
  magentoCityEn: 'magentoCityEn',
  magentoCityAr: 'magentoCityAr',
  storeCode: 'store',
  insuranceStoreCode: 'insuranceStore',
  tempStoreCode: 'tempStore',
}

/**
 * The preview grid: each line's number and action, then its cells under the spec's columns, then
 * what is wrong with it. An error line shows its cells by position, so a shifted column is seen.
 */
export function importPreviewColumns(t: TFunction, keys: readonly string[]): ColDef<ImportLine<string>>[] {
  return [
    { colId: 'line', headerName: t('import.preview.line'), width: 80, type: 'numericColumn', valueGetter: ({ data }) => data?.line },
    {
      colId: 'action',
      headerName: t('import.preview.action'),
      width: 150,
      valueGetter: ({ data }) => (!data ? '' : data.error ? t('import.action.error') : t(`import.action.${data.action}`)),
      cellClassRules: {
        'font-medium text-danger-800': ({ data }) => !!data?.error,
        'text-attention-800': ({ data }) => data?.action === 'delete',
      },
    },
    ...keys.map(
      (key, i): ColDef<ImportLine<string>> => ({
        colId: key,
        headerName: t(`columns.${IMPORT_HEADER[key as keyof typeof IMPORT_HEADER]}`),
        width: 150,
        valueGetter: ({ data }) => data?.cells[i] ?? '',
      }),
    ),
    {
      colId: 'problem',
      headerName: t('import.preview.problem'),
      minWidth: 280,
      flex: 1,
      valueGetter: ({ data }) =>
        data?.error
          ? t('import.problem.columnCount', { count: data.error.found, expected: data.error.expected, withDelete: data.error.expected + 1 })
          : '',
      cellClass: 'text-danger-800',
    },
  ]
}
