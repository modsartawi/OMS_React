/**
 * One planner table's tab (ticket 968, the owner's variant A): what the table is, the rows in force as a list, and a
 * click on a row opening it in a side sheet (`./RowSheet`). A switch field is switched straight from the list.
 */
import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { CellClickedEvent, RowClassParams } from 'ag-grid-community'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Plus } from 'lucide-react'

import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { PlannerRow, PlannerTableKey } from '@/core/models/sourcing-planner'
import { plannerKeys, sourcingPlannerApi } from './api'
import { PLANNER_DEFAULT_COL_DEF, SWITCH_COL, usePlannerColumns } from './columns'
import { NS, useFormat } from './display'
import OverrideProbe from './OverrideProbe'
import RowSheet from './RowSheet'
import { ruleGroups, ruleRows, switchRequest } from './rule-rows-model'
import { TABLES, todayIso } from './tables'

export default function PlannerTab({ table }: { table: PlannerTableKey }) {
  const { t } = useTranslation(NS)
  const queryClient = useQueryClient()
  const fmt = useFormat()
  const [showEnded, setShowEnded] = useState(false)
  const [open, setOpen] = useState<{ row: PlannerRow | null } | null>(null)
  const today = todayIso()

  const query = useQuery({ queryKey: plannerKeys.rows(table, showEnded), queryFn: () => sourcingPlannerApi.rows(table, showEnded) })
  const all = query.data?.rows ?? []
  const live = all.filter((r) => !r.endedAt)
  const rows = table === 'rules' ? [...ruleRows(all).map((r) => r.row), ...all.filter((r) => r.endedAt)] : all

  const switchRow = useMutation({
    mutationFn: (row: PlannerRow) => sourcingPlannerApi.change(table, switchRequest(row)),
    onSuccess: (_, row) => {
      toast.success(t(row.values[TABLES[table].switchField ?? 'on'] === true ? 'toast.switchedOff' : 'toast.switchedOn'))
      void queryClient.invalidateQueries({ queryKey: plannerKeys.table(table) })
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('sheet.failedFallback'))),
  })
  const onSwitch = useCallback((row: PlannerRow) => switchRow.mutate(row), [switchRow])
  const columns = usePlannerColumns(table, {
    showEnded,
    onSwitch: TABLES[table].switchField ? onSwitch : undefined,
    switching: switchRow.isPending ? (switchRow.variables?.id ?? null) : null,
  })

  const assumed = table === 'contracts' ? live.filter((r) => r.values.assumed === true).length : 0

  return (
    <div className="flex flex-col gap-3" data-planner-table={table}>
      <p className="text-xs text-muted-foreground">
        {t(`notes.${table}`)} {t('notes.everyRun')}
      </p>
      {assumed > 0 && (
        <p className="flex items-center gap-2 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-assumed-count={assumed}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            <Trans t={t} i18nKey="notes.assumed" count={assumed} values={{ n: String(assumed) }} components={{ v: <Ltr /> }} />
          </span>
        </p>
      )}
      {table === 'overrides' && <OverrideProbe rows={live} today={today} />}
      {table === 'rules' && live.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs" data-rule-groups="">
          {ruleGroups(live).map((g) => (
            <li key={g.key} className="rounded-md border border-border/60 bg-card px-2 py-1" data-rule-group={g.key}>
              {g.groupName == null && <span className="text-muted-foreground">{t(`opt.groupKind.${g.groupKind}`)} </span>}
              <bdi className="font-medium">{fmt('rules', 'group', g.group, g.rows[0]?.row)}</bdi>{' '}
              <span className="text-muted-foreground">{t('rules.counts', { on: fsi(String(g.on)), off: fsi(String(g.off)) })}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => setOpen({ row: null })} data-add="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('actions.add')}
        </Button>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} data-show-ended="" />
          {t('list.showEnded')}
        </label>
        <span className="ms-auto text-xs text-muted-foreground" data-row-count={live.length}>
          {t('list.count', { count: live.length, n: fsi(String(live.length)) })}
        </span>
      </div>
      {query.isError ? (
        <ErrorBanner title={t('list.failed')} message={apiErrorMessage(query.error, t('sheet.failedFallback'))} />
      ) : query.isPending ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {t('list.loading')}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground" data-planner-empty="">
          {t('list.empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/60" data-planner-grid={table}>
          <AgGridReact<PlannerRow>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={PLANNER_DEFAULT_COL_DEF}
            getRowId={({ data }) => data.id}
            rowHeight={OMS_GRID_ROW_HEIGHT + 6}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            domLayout="autoHeight"
            animateRows={false}
            suppressColumnVirtualisation
            getRowClass={(p: RowClassParams<PlannerRow>) => (p.data?.endedAt ? 'text-muted-foreground italic cursor-pointer' : 'cursor-pointer')}
            onCellClicked={(e: CellClickedEvent<PlannerRow>) => {
              if (e.data && e.column.getColId() !== SWITCH_COL) setOpen({ row: e.data })
            }}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('list.clickHint')}</p>
      {open && <RowSheet key={open.row?.id ?? 'new'} table={table} row={open.row} today={today} onClose={() => setOpen(null)} />}
    </div>
  )
}
