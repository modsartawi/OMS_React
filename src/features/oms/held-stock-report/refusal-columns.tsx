import type { TFunction } from 'i18next'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type {
  LastResortTake,
  MultiBatchLineCount,
  TakeRefusalGroup,
  TakeRefusalRow,
} from '@/core/models/held-stock-report'
import { pinStart } from '@/core/theme/direction'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { formatAge } from './shared'

/**
 * The refusal report's columns, one set per tab (BackOffice ticket 3873). Rows are drawn in the door's order; a group row
 * opens its log rows (the page's `onRowClicked`), so no cell carries its own link.
 *
 * Codes (store, material, batch, take id, document) are machine values: monospace, and exported as text so a spreadsheet
 * never turns `0012…` into a number. Feed ages stay seconds underneath (they sort as numbers) and draw as `h:mm:ss`.
 */

const CODE = 'font-mono text-[12px]'
const NUMBER: Partial<ColDef> = { type: 'numericColumn', cellClass: 'text-end tabular-nums', minWidth: 90 }

/** Every column id, so each has its header in both locales (`i18n-keys.test.ts`). */
export const REFUSAL_COLUMN_IDS = [
  'store', 'material', 'batch', 'kind', 'count', 'quantityAsked', 'quantityAvailable', 'reasons', 'sapFeedAge', 'posFeedAge',
  'firstAt', 'lastAt', 'loggedAt', 'takeId', 'code', 'reason', 'batchWithStock', 'batchWithStockExpiry',
  'batchWithStockQuantity', 'expiredQuantity', 'document', 'user', 'stage', 'lines', 'documentNo', 'sourceType',
  'sourceKey', 'lineNumber', 'pickIndex', 'quantity', 'pickedBy', 'pickedAt',
] as const

/** The column ids that carry a header hint, in both locales. */
export const REFUSAL_COLUMN_HINTS = ['quantityAvailable', 'sapFeedAge', 'posFeedAge', 'lines'] as const

/** Every code column id, exported as text. */
export const REFUSAL_TEXT_COLUMNS = new Set([
  'store', 'material', 'batch', 'takeId', 'code', 'batchWithStock', 'document', 'user', 'documentNo', 'sourceType', 'sourceKey',
  'pickedBy',
])

const figure = ({ value }: ValueFormatterParams) => formatFigure(value as number | null)
const age = ({ value }: ValueFormatterParams) => formatAge(value as number | null)
const field = (data: unknown, name: string) => (data as Record<string, unknown> | undefined)?.[name]

function num<R>(t: TFunction, colId: string): ColDef<R> {
  return {
    ...(NUMBER as Partial<ColDef<R>>),
    colId,
    field: colId as ColDef<R>['field'],
    headerName: t(`column.${colId}`),
    valueFormatter: figure,
  }
}

/** A code column; blank draws the dash. */
function code<R>(t: TFunction, colId: string, minWidth = 110): ColDef<R> {
  return {
    colId,
    headerName: t(`column.${colId}`),
    minWidth,
    cellClass: CODE,
    valueGetter: ({ data }) => (field(data, colId) as string | undefined) || t('dash'),
  }
}

function at<R>(t: TFunction, colId: string): ColDef<R> {
  return {
    colId,
    headerName: t(`column.${colId}`),
    minWidth: 140,
    valueGetter: ({ data }) => formatDateTime(field(data, colId) as string | undefined) || t('dash'),
  }
}

function feedAges<R>(t: TFunction): ColDef<R>[] {
  return (['sap', 'pos'] as const).map((feed) => ({
    ...(NUMBER as Partial<ColDef<R>>),
    colId: `${feed}FeedAge`,
    field: `${feed}FeedAgeSeconds` as ColDef<R>['field'],
    headerName: t(`column.${feed}FeedAge`),
    headerTooltip: t(`columnHint.${feed}FeedAge`),
    valueFormatter: age,
  }))
}

/** Real refusal or a shadow store's would-be one. */
function kind<R extends { isShadow: boolean }>(t: TFunction): ColDef<R> {
  return {
    colId: 'kind',
    headerName: t('column.kind'),
    minWidth: 120,
    valueGetter: ({ data }) => (data ? t(data.isShadow ? 'kind.shadow' : 'kind.real') : ''),
    cellClass: ({ data }) => (data?.isShadow ? 'italic text-muted-foreground' : ''),
  }
}

export function groupColumns(t: TFunction): ColDef<TakeRefusalGroup>[] {
  return [
    { ...code<TakeRefusalGroup>(t, 'store', 90), pinned: pinStart },
    { ...code<TakeRefusalGroup>(t, 'material'), pinned: pinStart },
    code<TakeRefusalGroup>(t, 'batch'),
    kind<TakeRefusalGroup>(t),
    num<TakeRefusalGroup>(t, 'count'),
    num<TakeRefusalGroup>(t, 'quantityAsked'),
    { ...num<TakeRefusalGroup>(t, 'quantityAvailable'), headerTooltip: t('columnHint.quantityAvailable') },
    { colId: 'reasons', field: 'reasons', headerName: t('column.reasons'), minWidth: 160, flex: 1, cellClass: CODE },
    ...feedAges<TakeRefusalGroup>(t),
    at<TakeRefusalGroup>(t, 'firstAt'),
    at<TakeRefusalGroup>(t, 'lastAt'),
  ]
}

export function rowColumns(t: TFunction): ColDef<TakeRefusalRow>[] {
  return [
    { ...at<TakeRefusalRow>(t, 'loggedAt'), pinned: pinStart },
    code<TakeRefusalRow>(t, 'store', 90),
    code<TakeRefusalRow>(t, 'material'),
    code<TakeRefusalRow>(t, 'batch'),
    kind<TakeRefusalRow>(t),
    num<TakeRefusalRow>(t, 'quantityAsked'),
    num<TakeRefusalRow>(t, 'quantityAvailable'),
    code<TakeRefusalRow>(t, 'code', 90),
    { colId: 'reason', field: 'reason', headerName: t('column.reason'), minWidth: 140, cellClass: CODE },
    code<TakeRefusalRow>(t, 'batchWithStock'),
    {
      colId: 'batchWithStockExpiry',
      headerName: t('column.batchWithStockExpiry'),
      minWidth: 110,
      valueGetter: ({ data }) => formatDay(data?.batchWithStockExpiry) || t('dash'),
    },
    num<TakeRefusalRow>(t, 'batchWithStockQuantity'),
    num<TakeRefusalRow>(t, 'expiredQuantity'),
    ...feedAges<TakeRefusalRow>(t),
    code<TakeRefusalRow>(t, 'takeId', 160),
    code<TakeRefusalRow>(t, 'document', 130),
    code<TakeRefusalRow>(t, 'user'),
    code<TakeRefusalRow>(t, 'stage'),
  ]
}

export function multiBatchColumns(t: TFunction): ColDef<MultiBatchLineCount>[] {
  return [
    { ...code<MultiBatchLineCount>(t, 'store', 120), pinned: pinStart },
    { ...num<MultiBatchLineCount>(t, 'lines'), flex: 1, headerTooltip: t('columnHint.lines') },
  ]
}

export function lastResortColumns(t: TFunction): ColDef<LastResortTake>[] {
  return [
    { ...at<LastResortTake>(t, 'pickedAt'), pinned: pinStart },
    code<LastResortTake>(t, 'store', 90),
    code<LastResortTake>(t, 'documentNo', 130),
    code<LastResortTake>(t, 'sourceType', 90),
    code<LastResortTake>(t, 'sourceKey', 140),
    num<LastResortTake>(t, 'lineNumber'),
    num<LastResortTake>(t, 'pickIndex'),
    code<LastResortTake>(t, 'material'),
    code<LastResortTake>(t, 'batch'),
    num<LastResortTake>(t, 'quantity'),
    code<LastResortTake>(t, 'takeId', 160),
    code<LastResortTake>(t, 'pickedBy'),
  ]
}
