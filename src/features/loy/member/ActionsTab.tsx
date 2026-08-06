import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Loader2, RotateCw } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import { showsPager } from '@/core/ui/pager'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import { LOY_ACTIONS_PAGE_SIZE, actionsKey, loyReportsApi } from './api'
import { ACTION_DEFAULT_COL_DEF, buildActionColumns } from './action-columns'
import { countedVolume } from './tab-volume'

/**
 * The Actions tab (ticket 238) — who did what to this account, and when.
 *
 * It is **the tab that is different from the other two by contrast**, and every
 * difference is the same difference: this read tells the truth about volume.
 * Activities and Sales are `TOP (n)` windows with no total, so they name a
 * ceiling and warn when they come back full. Actions has real `OFFSET/FETCH`
 * paging and a real `COUNT(*)`, so it 🚩 **states its actual total — "312
 * actions.", no hedging** — and pages 25 at a time through the pager ticket 232
 * graduated to `core`. An agent who has read all three captions knows which two
 * are windows.
 *
 * 🚩 **No sort and no filter**, alone among the three tabs, and deliberately:
 * *sort what you hold, never what you are paging through.* The reasoning lives on
 * `ACTION_DEFAULT_COL_DEF` where a reader meets it.
 *
 * Per the pager's house rule, **a one-page result grows no pager** — which is
 * most members.
 *
 * The three non-row states are the shell's and are deliberately identical to the
 * other two tabs': lazy on open (mount *is* the fetch), scoped inline
 * `ErrorBanner` with a Retry that refetches only this tab, and no toast. Only the
 * sentences differ, because "no actions recorded" and "no sales lines" are
 * different facts.
 */
export default function ActionsTab({ loyId }: { loyId: string }) {
  const { t } = useTranslation('loy')
  // Page lives here rather than in `?tab=`'s company on the URL: 227 put the open
  // TAB in the address so a link lands on the right question, and page 3 of an
  // audit trail is not a question anyone links to. Resetting to page 1 is what
  // leaving the member does, which is what unmounting this already is.
  const [page, setPage] = useState(1)

  const actions = useQuery({
    queryKey: actionsKey(loyId, page),
    queryFn: () => loyReportsApi.actions(loyId, page),
    staleTime: Infinity,
    // The previous page stays drawn while the next one is in flight, so paging
    // is a grid that changes rather than a grid that disappears. The pager goes
    // inert meanwhile (`busy`), so a double-click cannot skip a page.
    placeholderData: keepPreviousData,
  })

  const columns = useMemo(() => buildActionColumns(t), [t])
  const rows = actions.data?.records ?? []
  const volume = actions.data ? countedVolume(actions.data.recordsCount) : null

  return (
    <div className="flex flex-col gap-2">
      {/* 🚩 The real total, stated plainly — the one caption on this screen that
          is a count rather than a ceiling, and the contrast that tells an agent
          the other two tabs are windows. It appears only once the read has
          answered: before that there is no total, and naming a ceiling here
          would be inventing the very thing this tab does not have. */}
      {volume && (
        <p className="text-xs text-muted-foreground">
          {t(volume.captionKey, { total: volume.total.toLocaleString() })}
        </p>
      )}

      {actions.isPending ? (
        <div
          className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('tabs.actions.loading')}
        </div>
      ) : actions.isError ? (
        // Two sentences, as on the other two tabs and for the same reason: the
        // title names WHAT could not be read — the half only the client knows —
        // and the message is the server's through `apiErrorMessage`.
        <ErrorBanner
          title={t('tabs.actions.failed')}
          message={apiErrorMessage(actions.error, t('common:errors.server'))}
          className="p-3"
        >
          <button
            type="button"
            onClick={() => actions.refetch()}
            disabled={actions.isFetching}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-danger-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-danger-050 disabled:opacity-50"
          >
            <RotateCw
              className={'h-3 w-3 ' + (actions.isFetching ? 'animate-spin' : '')}
              aria-hidden
            />
            {t('tabs.retry')}
          </button>
        </ErrorBanner>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('tabs.actions.empty')}</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/60">
          <div className="h-[26rem]">
            <AgGridReact<(typeof rows)[number]>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={ACTION_DEFAULT_COL_DEF}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              {...omsGridDirection}
            />
          </div>
          {/* 🚩 A one-page result grows no pager. Next is arithmetic on the real
              total here — `isCapped` is omitted, which is the compiler-checked
              way of saying this caller holds a count and not a flag (232). */}
          {actions.data && showsPager(actions.data.recordsCount, LOY_ACTIONS_PAGE_SIZE) && (
            <GridPager
              page={page}
              pageSize={LOY_ACTIONS_PAGE_SIZE}
              totalMatches={actions.data.recordsCount}
              busy={actions.isFetching}
              onPage={setPage}
            />
          )}
        </div>
      )}
    </div>
  )
}
