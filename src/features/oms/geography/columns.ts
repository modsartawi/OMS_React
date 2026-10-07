import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { SdCityModel, SdDistrictModel } from '@/core/models/lookups'
import { formatDateTime } from '@/core/util/date-format'
import { lastChange } from './geography'

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
