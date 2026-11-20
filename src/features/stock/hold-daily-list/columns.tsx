import type { TFunction } from 'i18next'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import { HOLD_DAILY_LIST_KINDS, type HoldDailyListRow } from '@/core/models/hold-daily-list'
import { pinStart } from '@/core/theme/direction'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { ageParts, type StoreLine } from './list'

/**
 * HQ's daily list's columns, one set per tab (BackOffice ticket 3872). Each held unit is traced to its document, line,
 * pick index and take, with whatever of the sale, the donor request and the awaited reference the fill could name.
 * A store line opens that store's held units (the page's `onRowClicked`), so no cell carries its own link.
 *
 * Codes (store, document, material, batch, take, serial, sale, request) are machine values: monospace, and exported as
 * text so a spreadsheet never turns `0012…` into a number.
 */

const CODE = 'font-mono text-[12px]'
const NUMBER: Partial<ColDef> = { type: 'numericColumn', cellClass: 'text-end tabular-nums', minWidth: 90 }

/** Every column id, so each has its header in both locales (`i18n-keys.test.ts`). A kind's column is `kindShort.<kind>`. */
export const COLUMN_IDS = [
  'kind', 'cause', 'store', 'age', 'since', 'firstListedAt', 'documentNo', 'sourceType', 'sourceKey', 'documentState',
  'lineNumber', 'pickIndex', 'itemNumber', 'batch', 'heldQuantity', 'takeId', 'serialNumber', 'soldStore', 'soldTrx',
  'requestNo', 'orderStore', 'donorStore', 'reference', 'rows',
] as const

/** The column ids that carry a header hint, in both locales. */
export const COLUMN_HINTS = ['store', 'age', 'since', 'firstListedAt', 'reference'] as const

/** Every code column id, exported as text. */
export const TEXT_COLUMNS = new Set([
  'store', 'documentNo', 'sourceType', 'sourceKey', 'documentState', 'itemNumber', 'batch', 'takeId', 'serialNumber',
  'soldStore', 'soldTrx', 'requestNo', 'orderStore', 'donorStore', 'reference',
])

type RowCode = 'documentNo' | 'sourceType' | 'sourceKey' | 'documentState' | 'itemNumber' | 'batch' | 'takeId' |
  'serialNumber' | 'soldStore' | 'soldTrx' | 'requestNo' | 'orderStore' | 'donorStore' | 'reference'

const figure = ({ value }: ValueFormatterParams) => formatFigure(value as number | null)

/** A hold's age as the screen words it: days and hours past a day, hours and minutes below. */
export function ageText(t: TFunction, since: string | undefined, asOf: string): string {
  const age = since ? ageParts(since, asOf) : null
  if (!age) return t('dash')
  if (age.days > 0) return t('age.days', { d: age.days, h: age.hours })
  if (age.hours > 0) return t('age.hours', { h: age.hours, m: age.minutes })
  return t('age.minutes', { m: age.minutes })
}

function code(t: TFunction, field: RowCode, minWidth = 110): ColDef<HoldDailyListRow> {
  const dash = t('dash')
  return {
    colId: field,
    headerName: t(`column.${field}`),
    minWidth,
    cellClass: CODE,
    valueGetter: ({ data }) => (data ? data[field] || dash : ''),
  }
}

function num<R>(t: TFunction, colId: string): ColDef<R> {
  return {
    ...(NUMBER as Partial<ColDef<R>>),
    colId,
    field: colId as ColDef<R>['field'],
    headerName: t(`column.${colId}`),
    valueFormatter: figure,
  }
}

export function rowColumns(t: TFunction, asOf: string): ColDef<HoldDailyListRow>[] {
  const dash = t('dash')
  const when = (value: string | undefined) => formatDateTime(value) || dash
  return [
    {
      colId: 'kind',
      headerName: t('column.kind'),
      pinned: pinStart,
      minWidth: 170,
      valueGetter: ({ data }) => (data ? t(`kindShort.${data.kind}`, { defaultValue: data.kind }) : ''),
      tooltipValueGetter: ({ data }) => (data ? t(`kind.${data.kind}`, { defaultValue: data.kind }) : ''),
    },
    {
      colId: 'store',
      field: 'storeCode',
      headerName: t('column.store'),
      headerTooltip: t('columnHint.store'),
      pinned: pinStart,
      minWidth: 90,
      cellClass: CODE,
    },
    {
      colId: 'cause',
      headerName: t('column.cause'),
      minWidth: 150,
      valueGetter: ({ data }) => (data?.cause ? t(`causeShort.${data.cause}`, { defaultValue: data.cause }) : dash),
      tooltipValueGetter: ({ data }) => (data?.cause ? t(`cause.${data.cause}`, { defaultValue: data.cause }) : ''),
    },
    {
      colId: 'age',
      headerName: t('column.age'),
      headerTooltip: t('columnHint.age'),
      minWidth: 110,
      cellClass: 'tabular-nums',
      valueGetter: ({ data }) => ageText(t, data?.since, asOf),
      // Sorted by how long it stood: the earlier `since`, the older the hold.
      comparator: (_a, _b, nodeA, nodeB) => (nodeB.data?.since ?? '').localeCompare(nodeA.data?.since ?? ''),
    },
    { colId: 'since', headerName: t('column.since'), headerTooltip: t('columnHint.since'), minWidth: 150, valueGetter: ({ data }) => when(data?.since) },
    {
      colId: 'firstListedAt',
      headerName: t('column.firstListedAt'),
      headerTooltip: t('columnHint.firstListedAt'),
      minWidth: 150,
      valueGetter: ({ data }) => when(data?.firstListedAt),
    },
    code(t, 'documentNo', 140),
    code(t, 'sourceType', 90),
    code(t, 'sourceKey', 150),
    code(t, 'documentState', 110),
    num<HoldDailyListRow>(t, 'lineNumber'),
    num<HoldDailyListRow>(t, 'pickIndex'),
    code(t, 'itemNumber'),
    code(t, 'batch'),
    num<HoldDailyListRow>(t, 'heldQuantity'),
    code(t, 'takeId', 220),
    code(t, 'serialNumber', 150),
    code(t, 'soldStore', 90),
    code(t, 'soldTrx', 140),
    code(t, 'requestNo', 130),
    code(t, 'orderStore', 90),
    code(t, 'donorStore', 90),
    { ...code(t, 'reference', 160), headerTooltip: t('columnHint.reference') },
  ]
}

export function storeColumns(t: TFunction): ColDef<StoreLine>[] {
  return [
    { colId: 'store', field: 'storeCode', headerName: t('column.store'), pinned: pinStart, minWidth: 100, cellClass: CODE },
    ...HOLD_DAILY_LIST_KINDS.map(
      (kind): ColDef<StoreLine> => ({
        ...num<StoreLine>(t, kind),
        headerName: t(`kindShort.${kind}`),
        headerTooltip: t(`kind.${kind}`),
        flex: 1,
      }),
    ),
    { ...num<StoreLine>(t, 'rows'), flex: 1 },
    { ...num<StoreLine>(t, 'heldQuantity'), flex: 1 },
  ]
}
