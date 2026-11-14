import type { TFunction } from 'i18next'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { HeldImpactPair, HeldImpactRepairDay, HeldImpactSource } from '@/core/models/held-stock-report'
import { pinStart } from '@/core/theme/direction'
import { formatDay } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { unitsFrom } from './held'

/**
 * The held report's columns, one set per section (BackOffice ticket 3873). The figures are the door's, drawn as sent; the
 * Pairs grid carries one column per picking source type the report names (DRS among them), so DRS's holds read on their own.
 *
 * Codes (store, material, source type) are machine values: monospace, and exported as text.
 */

const CODE = 'font-mono text-[12px]'
const NUMBER: Partial<ColDef> = { type: 'numericColumn', cellClass: 'text-end tabular-nums', minWidth: 100 }

/** Every fixed column id, so each has its header in both locales (`i18n-keys.test.ts`). A per-source column's header is
 * the `column.heldBy` template around its code. */
export const HELD_COLUMN_IDS = [
  'store', 'material', 'channelToday', 'held', 'channelWithHeld', 'takenOff', 'fallsToZero', 'heldBeyondOpenPicks',
  'heldBy', 'sourceType', 'units', 'pairs', 'day', 'repairs', 'holdsReleased', 'holdsAdded',
] as const

/** The column ids that carry a header hint, in both locales. */
export const HELD_COLUMN_HINTS = [
  'channelToday', 'held', 'channelWithHeld', 'takenOff', 'fallsToZero', 'heldBeyondOpenPicks', 'units', 'pairs', 'repairs',
] as const

/** Every code column id, exported as text. */
export const HELD_TEXT_COLUMNS = new Set(['store', 'material', 'sourceType'])

const figure = ({ value }: ValueFormatterParams) => formatFigure(value as number | null)

function num<R>(t: TFunction, colId: string, hint = false): ColDef<R> {
  return {
    ...(NUMBER as Partial<ColDef<R>>),
    colId,
    field: colId as ColDef<R>['field'],
    headerName: t(`column.${colId}`),
    ...(hint ? { headerTooltip: t(`columnHint.${colId}`) } : {}),
    valueFormatter: figure,
  }
}

export function pairColumns(t: TFunction, sourceTypes: readonly string[]): ColDef<HeldImpactPair>[] {
  return [
    { colId: 'store', field: 'store', headerName: t('column.store'), pinned: pinStart, minWidth: 90, cellClass: CODE },
    { colId: 'material', field: 'material', headerName: t('column.material'), pinned: pinStart, minWidth: 110, cellClass: CODE },
    num<HeldImpactPair>(t, 'channelToday', true),
    num<HeldImpactPair>(t, 'held', true),
    num<HeldImpactPair>(t, 'channelWithHeld', true),
    num<HeldImpactPair>(t, 'takenOff', true),
    {
      colId: 'fallsToZero',
      headerName: t('column.fallsToZero'),
      headerTooltip: t('columnHint.fallsToZero'),
      minWidth: 110,
      valueGetter: ({ data }) => (data ? t(data.fallsToZero ? 'yes' : 'no') : ''),
      cellClass: ({ data }) => (data?.fallsToZero ? 'font-semibold text-attention-800' : ''),
    },
    ...sourceTypes.map(
      (sourceType): ColDef<HeldImpactPair> => ({
        ...(NUMBER as Partial<ColDef<HeldImpactPair>>),
        colId: `source:${sourceType}`,
        headerName: t('column.heldBy', { sourceType }),
        valueGetter: ({ data }) => (data ? unitsFrom(data, sourceType) : null),
        valueFormatter: figure,
      }),
    ),
    num<HeldImpactPair>(t, 'heldBeyondOpenPicks', true),
  ]
}

export function sourceColumns(t: TFunction): ColDef<HeldImpactSource>[] {
  return [
    { colId: 'sourceType', field: 'sourceType', headerName: t('column.sourceType'), pinned: pinStart, minWidth: 120, cellClass: CODE },
    { ...num<HeldImpactSource>(t, 'units', true), flex: 1 },
    { ...num<HeldImpactSource>(t, 'pairs', true), flex: 1 },
  ]
}

export function repairColumns(t: TFunction): ColDef<HeldImpactRepairDay>[] {
  return [
    { colId: 'day', headerName: t('column.day'), pinned: pinStart, minWidth: 120, valueGetter: ({ data }) => formatDay(data?.day) },
    { ...num<HeldImpactRepairDay>(t, 'repairs', true), flex: 1 },
    { ...num<HeldImpactRepairDay>(t, 'holdsReleased'), flex: 1 },
    { ...num<HeldImpactRepairDay>(t, 'holdsAdded'), flex: 1 },
  ]
}
