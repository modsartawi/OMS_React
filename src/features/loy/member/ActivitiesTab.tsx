import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Loader2, RotateCw } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import { activitiesKey, loyReportsApi } from './api'
import { ACTIVITY_DEFAULT_COL_DEF, buildActivityColumns } from './activity-columns'
import { cappedVolume } from './tab-volume'

/**
 * The Activities tab (ticket 236) — the tab an agent lands on, because "what
 * happened to my points" is the question that brought them here.
 *
 * It fetches on mount, and mount is the tab being open, so the laziness is the
 * shell's shape rather than a flag this file sets. `staleTime: Infinity` is the
 * other half: a tab is read once per member per page life, so leaving Activities
 * for Sales and coming back is free and does not restate a window that cannot
 * have moved while nothing on this read-only screen changed it.
 *
 * The three non-row states are all **scoped to this tab** (226 §8) — the member
 * header and the other two tabs are untouched by any of them:
 *
 * - **Loading** in the tab body, with the ceiling caption already visible.
 * - **Empty** is this tab's own sentence, never a shared "No data": "no loyalty
 *   activity" and "no sales lines" are different facts and an agent needs to know
 *   which one they are looking at.
 * - **Failed** is `ErrorBanner` inline with a **Retry that refetches only this
 *   tab** — 🚩 and no toast, because the state is already fully visible in the tab
 *   being looked at. The Retry earns its place on evidence: the realistic failure
 *   is a raw 500 with no envelope from a report that timed out, which is
 *   transient and often fine on a second attempt.
 *
 * 🚩 **Empty and failed are never conflated.** By the time this fetches the
 * member exists — only the *member* call can refuse a bad key, and the report
 * answers `[]` for a member with no history.
 */
export default function ActivitiesTab({ loyId }: { loyId: string }) {
  const { t } = useTranslation('loy')

  const activities = useQuery({
    queryKey: activitiesKey(loyId),
    queryFn: () => loyReportsApi.activities(loyId),
    staleTime: Infinity,
  })

  const columns = useMemo(() => buildActivityColumns(t), [t])
  const rows = activities.data ?? []
  // 🚩 The caption is computed from the rows that ARE on screen — so while the
  // read is in flight it names the ceiling and stays silent about the window,
  // which is the only honest thing to say about rows that do not exist yet.
  const volume = cappedVolume('activities', rows.length)

  return (
    <div className="flex flex-col gap-2">
      {/* The caption row: the ceiling always, the warning when the window came
          back full. 🚩 A bare row count is never here — it reads as
          completeness, which is the failure the caption exists to prevent. */}
      <p className="text-xs text-muted-foreground">
        {t(volume.captionKey, { cap: volume.cap })}
        {volume.warningKey && (
          <span className="ms-1.5 font-medium text-attention-800">{t(volume.warningKey)}</span>
        )}
      </p>

      {activities.isPending ? (
        <div
          className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('tabs.activities.loading')}
        </div>
      ) : activities.isError ? (
        // 🚩 Two sentences, and both are needed. The **title** is this tab's own
        // — it names WHAT could not be read, which is the half only the client
        // knows. The **message** is the server's through `apiErrorMessage`
        // (api-envelope), which on the realistic failure here — a raw 500 from a
        // report that timed out — is the generic server sentence, because a
        // crash carries no envelope to say anything better. Reading only the
        // server's would leave an agent on a member screen with three tabs
        // wondering which one broke.
        <ErrorBanner
          title={t('tabs.activities.failed')}
          message={apiErrorMessage(activities.error, t('common:errors.server'))}
          className="p-3"
        >
          <button
            type="button"
            onClick={() => activities.refetch()}
            disabled={activities.isFetching}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-danger-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-danger-050 disabled:opacity-50"
          >
            <RotateCw
              className={'h-3 w-3 ' + (activities.isFetching ? 'animate-spin' : '')}
              aria-hidden
            />
            {t('tabs.retry')}
          </button>
        </ErrorBanner>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('tabs.activities.empty')}
        </p>
      ) : (
        <div className="h-[26rem]">
          <AgGridReact<(typeof rows)[number]>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={ACTIVITY_DEFAULT_COL_DEF}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            {...omsGridDirection}
          />
        </div>
      )}
    </div>
  )
}
