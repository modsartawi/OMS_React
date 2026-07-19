import type { ColDef, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { SimulationResultItem } from '@/core/models/simulation'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import StatusDot from './StatusDot'
import PromoCell from './PromoCell'

type Col = ColDef<SimulationResultItem>

/** Results grid: sortable + resizable; no floating filters — the basket is small. */
export const SIM_RESULT_DEFAULT_COL_DEF: Col = {
  sortable: true,
  resizable: true,
}

/**
 * Per-line results columns, in WPF order: status dot, item, material (+ description),
 * qty, Promotion (kind chip + role — ticket 046), subtotal, promo, gross, tax, net.
 * Headers come from `t` (zero-literal); the money columns are right-aligned 2-decimal.
 * Field→column mapping (488): subtotal = netValue, promo = promotionDiscount,
 * gross = grossValue, tax = taxValue, net = netTotal. The Promotion column reads its
 * per-line refs from grid `context.promoByItem` (promoView, ticket 045), not row data.
 */
export function buildSimulationColumns(t: TFunction): Col[] {
  const money = (key: string, field: keyof SimulationResultItem, width: number): Col => ({
    headerName: t(`results.${key}`),
    field,
    width,
    type: 'numericColumn',
    valueFormatter: (p: ValueFormatterParams<SimulationResultItem>) => formatMoney(p.value as number),
  })

  return [
    {
      headerName: t('results.status'),
      field: 'pricingStatus',
      width: 84,
      sortable: false,
      cellRenderer: StatusDot,
    },
    { headerName: t('results.item'), field: 'itemNumber', width: 80, type: 'numericColumn' },
    { headerName: t('results.material'), field: 'materialNumber', width: 130 },
    { headerName: t('results.description'), field: 'materialDescription', flex: 1, minWidth: 160 },
    {
      headerName: t('results.qty'),
      colId: 'qty',
      width: 100,
      valueGetter: (p: ValueGetterParams<SimulationResultItem>) =>
        p.data ? `${formatNumber(p.data.quantity)} ${p.data.unitOfMeasure ?? ''}`.trim() : '',
    },
    {
      headerName: t('results.promotion'),
      colId: 'promotion',
      width: 210,
      sortable: false,
      autoHeight: true,
      cellRenderer: PromoCell,
    },
    money('subtotal', 'netValue', 110),
    money('promo', 'promotionDiscount', 110),
    money('gross', 'grossValue', 110),
    money('tax', 'taxValue', 110),
    money('net', 'netTotal', 110),
  ]
}
