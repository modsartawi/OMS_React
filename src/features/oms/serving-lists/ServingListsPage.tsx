import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import { Loader2, ShieldAlert } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { ApiError, apiErrorMessage } from '@/core/api'
import type { ServingListRow } from '@/core/models/serving-list'
import { canViewServingLists, servingListAccessQuery } from '@/core/serving-list/access'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { listsQuery } from './api'
import { LISTS_DEFAULT_COL_DEF, buildListColumns } from './columns'

/**
 * Serving lists — `/oms/serving-lists` (BackOffice spec 3042, oms ticket 567). Every serving list, with its
 * members (enabled of all) and the delivery types pointing at it, read-only. A row opens the list's detail
 * (`/oms/serving-lists/:id`, ticket 568). Pointing a type at a list is an HQ script, and there is no delete.
 *
 * Behind `canViewServingLists` on `GET ServingListWeb/Access` — the menu leaf reads the same predicate.
 */
export default function ServingListsPage() {
  const { t } = useTranslation('serving-lists')
  return (
    <ScreenGate query={servingListAccessQuery()} can={canViewServingLists} ns="serving-lists" title={t('title')} subtitle={t('subtitle')}>
      <Lists />
    </ScreenGate>
  )
}

function Lists() {
  const { t } = useTranslation('serving-lists')
  const navigate = useNavigate()
  const lists = useQuery(listsQuery())
  const columns = useMemo(() => buildListColumns(t), [t])
  // A bare 403 on the read is a refusal, never an empty grid.
  const refused = lists.error instanceof ApiError && lists.error.statusCode === 403

  if (refused) {
    return (
      <div className="mx-auto mt-8 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" data-lists-denied="">
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  }
  if (lists.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(lists.error, t('failed'))} />
  if (!lists.data) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    )
  }
  if (lists.data.length === 0) {
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-lists-empty="">
        {t('empty')}
      </p>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-2" data-serving-lists="">
      <div className="overflow-hidden rounded-md border border-border/60" data-lists-grid="">
        <AgGridReact<ServingListRow>
          theme={omsGridTheme}
          rowData={lists.data}
          columnDefs={columns}
          defaultColDef={LISTS_DEFAULT_COL_DEF}
          getRowId={({ data }) => data.servingListId}
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          domLayout="autoHeight"
          animateRows={false}
          suppressColumnVirtualisation
          rowClass="cursor-pointer"
          onRowClicked={(e) => e.data && navigate(`/oms/serving-lists/${encodeURIComponent(e.data.servingListId)}`)}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('readOnlyPointing')}</p>
    </div>
  )
}
