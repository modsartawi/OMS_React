import type { ColDef, ColGroupDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import { RAILS, type FleetStoreRow } from '@/core/models/sap-export'
import Ltr from '@/core/ui/Ltr'
import { WORST_FIRST, labelToken } from './label-helpers'
import { STORE_DAY_DEFAULT_COL_DEF } from './storeday-columns'
import { figure, formatHours, storeHref } from './storeday-helpers'
import TokenBadgeView from './TokenBadgeView'

/**
 * The fleet store list's columns (ticket 463). Sorting and paging are the door's, so no column
 * sorts or filters on the client: a sort over one page of 50 would reorder a page, not the fleet.
 * The same read-only base as the store-day grid.
 */
export const FLEET_DEFAULT_COL_DEF: ColDef = STORE_DAY_DEFAULT_COL_DEF

const MONO = 'font-mono text-[12px]'

/** A count that is blank at zero, so the cells that matter stand out (the ticket's ruling). */
const blankZero = (p: ValueFormatterParams<FleetStoreRow, number>) => (p.value ? figure(p.value) : '')

export function buildFleetColumns(t: TFunction): (ColDef<FleetStoreRow> | ColGroupDef<FleetStoreRow>)[] {
  return [
    {
      // 🔑 The way into the store page — a real anchor, so it can be middle-clicked and linked to.
      headerName: t('fleet.columns.code'),
      field: 'code',
      width: 90,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<FleetStoreRow>) =>
        p.data ? (
          <Link to={storeHref(p.data.code)} className="font-medium text-primary underline-offset-2 hover:underline" data-store-link={p.data.code}>
            <Ltr>{p.data.code}</Ltr>
          </Link>
        ) : null,
    },
    // The store's name is free text; the base cell isolates it (`<bdi>`, dir auto).
    { headerName: t('fleet.columns.description'), field: 'description', width: 150 },
    {
      // Worst first, as the store-day chips read.
      headerName: t('fleet.columns.labels'),
      children: WORST_FIRST.map(
        (label): ColDef<FleetStoreRow> => ({
          headerName: t(`labels.${label}`),
          colId: `label-${label}`,
          width: label === 'heldForInventory' ? 135 : 85,
          type: 'rightAligned',
          valueGetter: (p: ValueGetterParams<FleetStoreRow>) => p.data?.labels[label] ?? 0,
          valueFormatter: blankZero,
        }),
      ),
    },
    {
      headerName: t('fleet.columns.railMix'),
      children: RAILS.map(
        (rail): ColDef<FleetStoreRow> => ({
          headerName: t(`rails.${rail}`),
          colId: `rail-${rail}`,
          width: 85,
          type: 'rightAligned',
          valueGetter: (p: ValueGetterParams<FleetStoreRow>) => p.data?.railMix[rail] ?? 0,
          valueFormatter: (p: ValueFormatterParams<FleetStoreRow, number>) => figure(p.value ?? 0),
        }),
      ),
    },
    {
      headerName: t('fleet.columns.oldestBehind'),
      field: 'oldestBehindHours',
      width: 140,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<FleetStoreRow, number | null>) => formatHours(p.value ?? null),
    },
    {
      // A store whose every day agrees reads blank, like a zero label count.
      headerName: t('fleet.columns.breakDays'),
      field: 'breakDays',
      width: 100,
      type: 'rightAligned',
      valueFormatter: blankZero,
    },
    {
      // The store-level flags, in the label ruling's tokens: stalled is a silent stop (stuck's
      // danger); inventory-gated is a deliberate count freeze (held for inventory's info, never red).
      headerName: t('fleet.columns.markers'),
      colId: 'markers',
      flex: 1,
      minWidth: 270,
      cellRenderer: (p: ICellRendererParams<FleetStoreRow>) => {
        if (!p.data || (!p.data.legacyStalled && !p.data.legacyInventoryGated)) return null
        return (
          <span className="inline-flex flex-wrap items-center gap-1" data-markers="">
            {p.data.legacyStalled && (
              <span data-marker="legacyStalled">
                <TokenBadgeView badge={{ token: labelToken('stuck').token, labelKey: 'fleet.markers.legacyStalled' }} value="legacyStalled" />
              </span>
            )}
            {p.data.legacyInventoryGated && (
              <span data-marker="legacyInventoryGated">
                <TokenBadgeView
                  badge={{ token: labelToken('heldForInventory').token, labelKey: 'fleet.markers.legacyInventoryGated' }}
                  value="legacyInventoryGated"
                />
              </span>
            )}
          </span>
        )
      },
    },
  ]
}
