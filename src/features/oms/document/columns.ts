import type {
  CellClassParams,
  ColDef,
  RowClassParams,
  RowSelectionOptions,
  RowStyle,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community'
import i18n from '@/core/i18n'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { describeConditionCategory, describeConditionType } from '@/core/constants/oms-codes'
import type { SdDocumentLineModel, TransactionConditionModel } from '@/core/models/sd-document'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import { isDiscountFlagged } from './items'

const t = (key: string) => i18n.t(`document:${key}`)

/** Render a boolean as `Yes` / `No` text, blank when unset (D-13). */
function boolText(value: unknown): string {
  if (value === true) return i18n.t('common:yes')
  if (value === false) return i18n.t('common:no')
  return ''
}

/**
 * Column builders bound to one row model — type-checked field names with
 * consistent dense formatting across every Screen 2 detail grid.
 */
function columnKit<T>() {
  type Col = ColDef<T>
  type Field = keyof T & string

  // A generic `T` cannot prove `keyof T & string` matches AG Grid's
  // `ColDefField<T>` template-literal type, so the bound field name is widened
  // here; call-site safety comes from typing every builder's `field` parameter.
  const asField = (field: Field): Col['field'] => field as unknown as Col['field']

  return {
    text: (key: string, field: Field, width: number): Col => ({
      headerName: t(`columns.${key}`),
      field: asField(field),
      width,
    }),
    money: (key: string, field: Field, width: number): Col => ({
      headerName: t(`columns.${key}`),
      field: asField(field),
      width,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      valueFormatter: (p: ValueFormatterParams<T>) => formatMoney(p.value as number | null),
    }),
    number: (key: string, field: Field, width: number): Col => ({
      headerName: t(`columns.${key}`),
      field: asField(field),
      width,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      valueFormatter: (p: ValueFormatterParams<T>) => formatNumber(p.value as number | null),
    }),
    /** `yyyy-MM-dd HH:mm` — the Screen 1 grid format. */
    dateTime: (key: string, field: Field, width: number): Col => ({
      headerName: t(`columns.${key}`),
      field: asField(field),
      width,
      valueFormatter: (p: ValueFormatterParams<T>) => formatDateTime(p.value as string | null),
    }),
    /** `Yes`/`No` — the VALUE is the text, so filter and sort agree with the eye. */
    bool: (key: string, field: Field, width: number): Col => ({
      headerName: t(`columns.${key}`),
      colId: field,
      width,
      valueGetter: (p: ValueGetterParams<T>) => boolText(p.data?.[field]),
    }),
  }
}

/**
 * The Screen 2 detail-grid columns.
 *
 * Built lazily, on first use, rather than at module scope: the header names come
 * from `i18n.t`, and a module-level array would freeze whatever strings existed
 * at import time.
 */
export const documentColumns = {
  items(): ColDef<SdDocumentLineModel>[] {
    const item = columnKit<SdDocumentLineModel>()
    return [
      {
        // Description first: the eye should land on a name, not a number
        // (083 D-9). It is also the column the pinned totals row labels itself
        // in — `4 lines · 7 units`, digits at both ends of a spaced run, which an
        // RTL paragraph reorders to `lines · 7 units 4` (095). The base renderer
        // in `DETAIL_DEFAULT_COL_DEF` isolates it whole, like every other cell.
        ...item.text('description', 'itemDescription', 280),
      },
      item.text('itemNumber', 'itemNumber', 130),
      item.money('unitPrice', 'unitPrice', 110),
      item.number('quantity', 'quantity', 100),
      {
        ...item.money('discount', 'discount', 110),
        // Amber on any non-zero discount, with the payload's own sign — the rule
        // and its evidence live in `items.ts`. A `cellClassRules` class, not a
        // `cellStyle` colour: colours are authored once, in `global.css` (089).
        // Ink only, no weight bump — D-9 specifies `--attention-800` and the
        // amber IS the flag.
        cellClassRules: {
          'text-attention-800': (p: CellClassParams<SdDocumentLineModel>) =>
            isDiscountFlagged(p.value),
        },
      },
      item.money('grossAmount', 'grossAmount', 120),
      item.money('vatAmount', 'vatAmount', 110),
      item.money('netAmount', 'netAmount', 115),
      item.bool('needTransaction', 'needTransaction', 140),
      item.bool('deleted', 'deleted', 95),
      item.text('referenceErx', 'referenceErxLine', 130),
    ]
  },

  conditions(): ColDef<TransactionConditionModel>[] {
    const condition = columnKit<TransactionConditionModel>()
    return [
      {
        headerName: t('columns.category'),
        colId: 'condCategory',
        width: 130,
        valueGetter: (p: ValueGetterParams<TransactionConditionModel>) =>
          describeConditionCategory(p.data?.condCategory),
      },
      {
        // Description-first, code-map second — see `describeConditionType`.
        headerName: t('columns.condType'),
        colId: 'condType',
        width: 190,
        valueGetter: (p: ValueGetterParams<TransactionConditionModel>) =>
          describeConditionType(p.data?.condType, p.data?.conditionDescription),
      },
      condition.money('condAmount', 'condAmount', 120),
      condition.dateTime('condDate', 'condDate', 140),
      condition.text('referenceNumber', 'referenceNumber', 160),
      condition.text('paymentType', 'paymentType', 120),
    ]
  },

}

/**
 * Default column behaviour for the detail grids. `cellDataType: false` keeps
 * booleans on the explicit `Yes`/`No` value-getter instead of AG Grid's checkbox
 * renderer (D-13).
 */
export const DETAIL_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: 'agTextColumnFilter',
  floatingFilter: true,
  cellDataType: false,
}

/**
 * Single-row click selection on the items grid (083 D-9). The leading accent bar
 * it reveals is 082's theme — `.ag-row-selected…::before` in `global.css`, on a
 * logical `inset-inline-start` — so this slice only turns selection on.
 */
export const ITEM_ROW_SELECTION: RowSelectionOptions<SdDocumentLineModel> = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
}

/**
 * Items-tab row treatment — a deleted line reads muted and struck through
 * (083 D-9). A deleted line indistinguishable from a live one is a real reading
 * hazard: the operator acts on a line the document no longer carries.
 *
 * A row style rather than a class, and `var(--muted-foreground)` rather than a
 * literal — colour values are authored only in `global.css` (089). The pinned
 * totals row carries no `deleted`, so it is never struck.
 */
export function deletedLineRowStyle(
  params: RowClassParams<SdDocumentLineModel>,
): RowStyle | undefined {
  return params.data?.deleted === true
    ? { color: 'var(--muted-foreground)', textDecoration: 'line-through' }
    : undefined
}
