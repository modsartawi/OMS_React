import type { TFunction } from 'i18next'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import { pinStart } from '@/core/theme/direction'
import { formatFigure } from '@/core/util/number-format'
import type { GateRow } from './gates'

/**
 * The gate figures' columns (BackOffice ticket 3900): one row per store, each gate's figure beside whether it holds. The
 * figures are the door's, drawn as sent. Codes (store, tills) are machine values: monospace, and exported as text.
 */

const CODE = 'font-mono text-[12px]'
const NUMBER: Partial<ColDef<GateRow>> = { type: 'numericColumn', cellClass: 'text-end tabular-nums', minWidth: 100 }

/** Every column id, so each has its header and hint in both locales (`i18n-keys.test.ts`). */
export const GATE_COLUMN_IDS = [
  'store', 'holds', 'takesReported', 'withinOneSecondPercent', 'unansweredPercent', 'takesHold', 'deliveriesWithoutPick',
  'deliveryDays', 'deliveriesHold', 'tillsSeen', 'tillsOnAnOldEngine', 'tillsHold',
] as const

/** The column ids that carry a header hint. */
export const GATE_COLUMN_HINTS = [
  'withinOneSecondPercent', 'unansweredPercent', 'deliveriesWithoutPick', 'tillsOnAnOldEngine',
] as const

export const GATE_TEXT_COLUMNS = new Set(['store', 'deliveryDays', 'tillsOnAnOldEngine'])

const figure = ({ value }: ValueFormatterParams) => formatFigure(value as number | null)

function header(t: TFunction, colId: string): Partial<ColDef<GateRow>> {
  const hinted = (GATE_COLUMN_HINTS as readonly string[]).includes(colId)
  return {
    colId,
    field: colId as ColDef<GateRow>['field'],
    headerName: t(`column.${colId}`),
    ...(hinted ? { headerTooltip: t(`columnHint.${colId}`) } : {}),
  }
}

const num = (t: TFunction, colId: string): ColDef<GateRow> => ({ ...NUMBER, ...header(t, colId), valueFormatter: figure })

function verdict(t: TFunction, colId: keyof GateRow): ColDef<GateRow> {
  return {
    ...header(t, colId),
    field: undefined,
    minWidth: 90,
    valueGetter: ({ data }) => (data ? t(data[colId] ? 'yes' : 'no') : ''),
    cellClass: ({ data }) => (data && !data[colId] ? 'font-semibold text-attention-800' : ''),
  }
}

export function gateColumns(t: TFunction): ColDef<GateRow>[] {
  return [
    { ...header(t, 'store'), pinned: pinStart, minWidth: 90, cellClass: CODE },
    verdict(t, 'holds'),
    num(t, 'takesReported'),
    num(t, 'withinOneSecondPercent'),
    num(t, 'unansweredPercent'),
    verdict(t, 'takesHold'),
    num(t, 'deliveriesWithoutPick'),
    { ...header(t, 'deliveryDays'), minWidth: 180, cellClass: CODE },
    verdict(t, 'deliveriesHold'),
    num(t, 'tillsSeen'),
    { ...header(t, 'tillsOnAnOldEngine'), minWidth: 160, cellClass: CODE },
    verdict(t, 'tillsHold'),
  ]
}
