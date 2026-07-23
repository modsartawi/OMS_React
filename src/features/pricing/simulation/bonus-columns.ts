import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { PricingElement } from '@/core/models/simulation'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import BoolCell from './BoolCell'

/** Bonus-buy / pricing-elements grids (ticket 015): sortable + resizable, no
 *  floating filters — these grids are short and driven by the priced result. */
export const BONUS_DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  resizable: true,
}

const money =
  <T,>(t: TFunction, key: string, field: keyof T & string, width: number): ColDef<T> => ({
    headerName: t(key),
    field: field as unknown as ColDef<T>['field'],
    width,
    type: 'numericColumn',
    valueFormatter: (p: ValueFormatterParams) => formatMoney(p.value as number),
  })

const num =
  <T,>(t: TFunction, key: string, field: keyof T & string, width: number): ColDef<T> => ({
    headerName: t(key),
    field: field as unknown as ColDef<T>['field'],
    width,
    type: 'numericColumn',
    valueFormatter: (p: ValueFormatterParams) => formatNumber(p.value as number),
  })

/** Pricing Elements: step / counter / type / description / base / rate / unit /
 *  value / statistical / subtotal / bonus-buy — the raw procedure trace. */
export function buildPricingElementColumns(t: TFunction): ColDef<PricingElement>[] {
  const flag = (key: string, field: keyof PricingElement): ColDef<PricingElement> => ({
    headerName: t(key),
    field: field as ColDef<PricingElement>['field'],
    width: 100,
    sortable: false,
    cellRenderer: BoolCell,
    cellRendererParams: { mode: 'check' },
  })

  return [
    num<PricingElement>(t, 'bonus.elements.step', 'stepNumber', 80),
    num<PricingElement>(t, 'bonus.elements.counter', 'conditionCounter', 90),
    { headerName: t('bonus.elements.type'), field: 'conditionType', width: 100 },
    { headerName: t('bonus.elements.description'), field: 'description', flex: 1, minWidth: 180 },
    money<PricingElement>(t, 'bonus.elements.base', 'conditionBaseValue', 110),
    num<PricingElement>(t, 'bonus.elements.rate', 'conditionRate', 100),
    { headerName: t('bonus.elements.unit'), field: 'conditionRateUnit', width: 90 },
    money<PricingElement>(t, 'bonus.elements.value', 'conditionValue', 110),
    flag('bonus.elements.statistical', 'isStatistics'),
    flag('bonus.elements.subtotal', 'isSubtotal'),
    flag('bonus.elements.bonusBuy', 'isBonusBuy'),
  ]
}
