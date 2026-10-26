import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import { Loader2 } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import { folderTree, inFolder } from '@/core/insurance-rules/folders'
import { guardRulePath, type GuardRuleRow } from '@/core/insurance-rules/model'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatCount } from '@/core/util/bidi'
import { guardsQuery } from './api'
import { GUARDS_DEFAULT_COL_DEF, buildGuardColumns } from './columns'
import DeniedCard from './DeniedCard'
import FolderTree from './FolderTree'
import { folderFromParams, folderToParams } from './folder-query'

/**
 * Insurance rules ▸ Guards — `/insurance-rules/guards` (BackOffice spec 3126, oms ticket 607). Every guard
 * rule, by folder (the tree beside the grid; `?folder=` in the address), with its state, severity, folder,
 * last fired and the metrics' flags. A row opens the rule read as sentences (`/insurance-rules/guards/:ruleId`).
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 on the read is "You do not have access".
 */
export default function GuardsPage() {
  const { t } = useTranslation('insurance-guards')
  return (
    <section className="flex h-full w-full flex-col gap-4" data-guards-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('list.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('list.lede')}</p>
      </header>
      <Guards />
    </section>
  )
}

function Guards() {
  const { t } = useTranslation('insurance-guards')
  const navigate = useNavigate()
  const guards = useQuery(guardsQuery())
  const { query: folder, update } = useUrlQuery(folderFromParams, folderToParams)
  const columns = useMemo(() => buildGuardColumns(t), [t])
  const all = guards.data
  const tree = useMemo(() => folderTree(all ?? []), [all])
  const rows = useMemo(() => (all ?? []).filter((r) => inFolder(r.folder, folder)), [all, folder])

  if (guards.isError && isBareDenial(guards.error)) return <DeniedCard hook="guards-denied" />
  if (guards.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(guards.error, t('list.failed'))} />
  if (!all) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('list.loading')}
      </div>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      <aside className="w-full shrink-0 md:w-64">
        <FolderTree nodes={tree} total={all.length} picked={folder} onPick={(p) => update(() => p)} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-xs text-muted-foreground" data-shown="">
          {t('list.shown')} <Ltr>{formatCount(rows.length, all.length)}</Ltr>
        </p>
        {rows.length === 0 ? (
          <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-guards-empty="">
            {t('list.empty')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border/60" data-guards-grid="">
            <AgGridReact<GuardRuleRow>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={GUARDS_DEFAULT_COL_DEF}
              getRowId={({ data }) => data.id}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              domLayout="autoHeight"
              animateRows={false}
              suppressColumnVirtualisation
              rowClass="cursor-pointer"
              onRowClicked={(e) => e.data && navigate(guardRulePath(e.data.id), { state: { folder } })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
