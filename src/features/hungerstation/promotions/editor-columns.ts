import type { ColDef } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { HungerStationPromotionItemInput } from '@/core/models/hungerstation'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { stripIsolates } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { rowCombination, type BundleDefaults } from './bundle-columns'
import { checkCellText, type CheckedRow } from './check-summary'
import { partLabel } from './part-label'
import { discountText } from './promotion-display'
import { subtypeText } from './promotion-words'

/** An item row of the editor's preview grid with its Check answer ON the row: a new answer is new
 *  row data, which AG Grid redraws (a value getter reading outside state would keep the old cell). */
export type ItemRow = HungerStationPromotionItemInput & { check: CheckedRow | null }

export const ITEM_COL_DEF: ColDef<ItemRow> = { ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true, suppressHeaderMenuButton: true }

/** How the Check marks an item row: refused, warned (a price warning only), or not at all. */
export function rowKind(data: ItemRow | undefined): 'refused' | 'warned' | null {
  const r = data?.check
  return !r ? null : r.refusals.length ? 'refused' : r.warningStores.length ? 'warned' : null
}

const GREY = 'text-muted-foreground italic'

/** A bundle's buy or get column: the row's own (contract 3213: there is no promotion default). */
function quantityColumn(key: 'buyQuantity' | 'getQuantity', header: string): ColDef<ItemRow> {
  return { colId: key, headerName: header, width: 90, type: 'rightAligned', valueGetter: ({ data }) => (data?.[key] == null ? '' : figure(data[key])) }
}

/**
 * The editor's item grid (666 strikethrough, 668 bundle): material, [buy, get], subtype, value, max
 * quantity, [the row's combination in words], and the Check cell. A blank subtype / value reads the
 * header default, greyed. Grid values carry NO isolates (.claude/rules/bidi.md: they reach Ctrl+C);
 * the grid base isolates each cell.
 */
export function editorItemColumns(t: TFunction<'hungerstation-promotions'>, bundle: boolean, defaults: BundleDefaults): ColDef<ItemRow>[] {
  const tt = t as unknown as TFunction
  return [
    { colId: 'material', headerName: t('editor.items.material'), field: 'materialNumber', width: 160 },
    ...(bundle ? [quantityColumn('buyQuantity', t('editor.items.buy')), quantityColumn('getQuantity', t('editor.items.get'))] : []),
    {
      colId: 'subtype',
      headerName: t('editor.items.subtype'),
      width: 180,
      valueGetter: ({ data }) => (data ? subtypeText(tt, data.subtype ?? defaults.subtype) : ''),
      cellClassRules: { [GREY]: ({ data }) => data?.subtype === null },
    },
    {
      colId: 'value',
      headerName: t('editor.items.value'),
      width: 140,
      type: 'rightAligned',
      valueGetter: ({ data }) => (data ? discountText(tt, data.subtype ?? defaults.subtype, data.value ?? defaults.value) : ''),
      cellClassRules: { [GREY]: ({ data }) => data?.value === null },
    },
    { colId: 'maxQuantity', headerName: t('editor.items.maxQuantity'), width: 120, type: 'rightAligned', valueGetter: ({ data }) => (data?.maxQuantity == null ? '' : figure(data.maxQuantity)) },
    // 668: the row's combination in words, as it will read once saved — the row's, never a part.
    // `partLabel` isolates for a sentence sink; a grid cell takes none.
    ...(bundle
      ? [{ colId: 'combination', headerName: t('editor.items.combination'), width: 240, valueGetter: ({ data }) => (data ? stripIsolates(partLabel(t, rowCombination(data, defaults))) : '') } satisfies ColDef<ItemRow>]
      : []),
    {
      colId: 'refusal',
      headerName: t('editor.items.refusal'),
      flex: 1,
      minWidth: 260,
      // 667: the row's refusals in words, else its price warning — never an isolate (review C1).
      valueGetter: ({ data }) => checkCellText(t, data?.check ?? null),
      cellClassRules: {
        'text-danger-800': ({ data }) => rowKind(data) === 'refused',
        'text-attention-800': ({ data }) => rowKind(data) === 'warned',
      },
    },
  ]
}
