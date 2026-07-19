import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { PotentialBonusBuy, PrereqStatus, PricingElement } from '@/core/models/simulation'
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

/** Potential Bonus Buys: bby / promo / description / status / valid-to / min value
 *  / skip reason — promotions that could apply. Row selection drives Prerequisites. */
export function buildPotentialBonusColumns(t: TFunction): ColDef<PotentialBonusBuy>[] {
  return [
    { headerName: t('bonus.potential.bby'), field: 'bbyNumber', width: 120 },
    { headerName: t('bonus.potential.promo'), field: 'promoNumber', width: 120 },
    { headerName: t('bonus.potential.description'), field: 'description', flex: 1, minWidth: 180 },
    { headerName: t('bonus.potential.status'), field: 'bbyStatus', width: 100 },
    { headerName: t('bonus.potential.validTo'), field: 'validTo', width: 120 },
    money<PotentialBonusBuy>(t, 'bonus.potential.minValue', 'minValue', 120),
    { headerName: t('bonus.potential.skipReason'), field: 'skipReason', flex: 1, minWidth: 160 },
  ]
}

/** Prerequisites: prereq / material grouping / material / required vs found qty /
 *  min vs found value / met? — the selected potential bonus buy's requirements. */
export function buildPrereqColumns(t: TFunction): ColDef<PrereqStatus>[] {
  return [
    { headerName: t('bonus.prereq.prereq'), field: 'prereqNumber', width: 110 },
    { headerName: t('bonus.prereq.matGrouping'), field: 'matGrouping', width: 140 },
    { headerName: t('bonus.prereq.material'), field: 'materialNumber', width: 130 },
    num<PrereqStatus>(t, 'bonus.prereq.requiredQty', 'requiredQty', 120),
    num<PrereqStatus>(t, 'bonus.prereq.foundQty', 'foundQty', 110),
    money<PrereqStatus>(t, 'bonus.prereq.minValue', 'minValue', 110),
    money<PrereqStatus>(t, 'bonus.prereq.foundValue', 'foundValue', 120),
    {
      headerName: t('bonus.prereq.met'),
      field: 'isMet',
      width: 90,
      sortable: false,
      cellRenderer: BoolCell,
      cellRendererParams: { mode: 'met' },
    },
  ]
}

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
