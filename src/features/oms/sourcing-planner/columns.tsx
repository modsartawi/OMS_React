/**
 * A planner table's grid columns (ticket 968). Every field is a column (a switch field is a chip the row is switched
 * with, straight from the list), then since when and by whom the version stands, and when it ended.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { Loader2 } from 'lucide-react'

import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Chip from '@/core/ui/Chip'
import type { PlannerRow, PlannerTableKey, PlannerValue } from '@/core/models/sourcing-planner'
import { NS, useFormat } from './display'
import { TABLES } from './tables'

export const PLANNER_DEFAULT_COL_DEF: ColDef<PlannerRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  resizable: true,
  sortable: true,
  suppressHeaderMenuButton: true,
}

/** The column a switch lives in; a click on it switches the row and does not open the sheet. */
export const SWITCH_COL = 'switch'

export function usePlannerColumns(
  table: PlannerTableKey,
  opts: { showEnded: boolean; onSwitch?: (row: PlannerRow) => void; switching?: ReadonlySet<string> },
): ColDef<PlannerRow>[] {
  const { t } = useTranslation(NS)
  const fmt = useFormat()
  const { showEnded, onSwitch, switching } = opts
  return useMemo(() => {
    const spec = TABLES[table]
    const cols: ColDef<PlannerRow>[] = []
    for (const f of spec.fields) {
      const header = t(`fields.${table}.${f.key}`)
      if (f.key === spec.switchField) {
        cols.push({
          colId: SWITCH_COL,
          headerName: header,
          width: 96,
          valueGetter: (p) => p.data?.values[f.key] === true,
          cellRenderer: (p: ICellRendererParams<PlannerRow>) => {
            const row = p.data
            if (!row) return null
            const on = row.values[f.key] === true
            const busy = !!switching?.has(row.id)
            return (
              <Chip
                on={on}
                disabled={!!row.endedAt || !onSwitch || busy}
                onClick={() => onSwitch?.(row)}
                aria-label={t(on ? 'switch.turnOff' : 'switch.turnOn')}
                data-switch={on ? 'on' : 'off'}
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                {t(on ? 'switch.on' : 'switch.off')}
              </Chip>
            )
          },
        })
        continue
      }
      cols.push({
        colId: f.key,
        headerName: header,
        valueGetter: (p) => (p.data?.values[f.key] ?? null) as PlannerValue,
        valueFormatter: (p) => (p.data ? fmt(table, f.key, p.value as PlannerValue, p.data) : ''),
        width:
          f.kind === 'bool'
            ? 104
            : f.key === 'cities' || f.key === 'note' || f.key === 'group'
              ? 200
              : f.kind === 'store' || f.kind === 'item' || f.kind === 'category' || f.kind === 'listCode'
                ? 210
                : 130,
      })
    }
    cols.push({ colId: 'setAt', headerName: t('grid.since'), width: 160, valueGetter: (p) => p.data?.setAt ?? '' })
    cols.push({ colId: 'setBy', headerName: t('grid.by'), width: 120, valueGetter: (p) => p.data?.setBy ?? '' })
    if (showEnded) cols.push({ colId: 'endedAt', headerName: t('grid.ended'), width: 160, valueGetter: (p) => p.data?.endedAt ?? '' })
    return cols
  }, [table, t, fmt, showEnded, onSwitch, switching])
}
