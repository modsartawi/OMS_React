import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Loader2, X } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ErrorBanner from '@/core/ui/ErrorBanner'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import { SHEET } from '@/core/ui/overlay'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import type { Job, TableTask } from '@/core/models/data-sync'
import { jobQuery } from './api'
import { DATA_SYNC_DEFAULT_COL_DEF } from './campaign-columns'
import { buildTableTaskColumns } from './job-columns'
import { isDataSyncNotFound, jobStateWords, storeLabel } from './job-helpers'
import { FailureView, JobReasonView, JobStatusView } from './JobStateView'
import { groupDigits } from './helpers'

const tableTaskId = ({ data }: { data: TableTask }) => data.tableTaskId

/**
 * One job's drawer (ticket 560), opened by `?job=<jobId>` so it can be linked. Reads
 * `GET DataSync/Jobs/{id}` (the job may not be on the jobs page shown) and polls with the page.
 * Shows the target server and database and each table: status, phase, disposition, strategy,
 * chunk progress, the counts, the failure and the "manifest truncated" flag.
 *
 * 🔌 `footer` is the seam for what a later slice hangs off one job: the Changes link (562, a
 * report-only job, Operate only) and the job's Pause / Resume / Cancel (563). Drawn under the
 * tables once the job is read.
 */
export default function JobDrawer({
  campaignId,
  jobId,
  refetchInterval,
  onClose,
  footer,
}: {
  campaignId: string
  jobId: string
  refetchInterval: number | false
  onClose: () => void
  footer?: (job: Job) => ReactNode
}) {
  const { t } = useTranslation('data-sync')
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const read = useQuery(jobQuery(campaignId, jobId, refetchInterval))
  const columns = useMemo(() => buildTableTaskColumns(t), [t])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => dialog.close()
  }, [])

  const job = read.data
  const notFound = read.isError && isDataSyncNotFound(read.error)

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-job-drawer={jobId}
      onCancel={(e) => {
        e.preventDefault()
        // As core's Modal: Escape belongs to the top dialog, never to one that holds it too.
        e.stopPropagation()
        if (e.target === ref.current) onClose()
      }}
      onClose={() => {
        if (ref.current && !ref.current.open) onClose()
      }}
      // The backdrop reports the dialog itself as the target; content never does.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={'end-0 my-0 me-0 ms-auto h-dvh max-h-dvh w-[80rem] max-w-[96vw] border-0 border-s p-0 ' + SHEET}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t('drawer.eyebrow')}</span>
            <h2 id={titleId} className="font-mono text-sm font-semibold tracking-tight" data-job-title="">
              {job ? <Ltr>{storeLabel(job.store)}</Ltr> : <Ltr>{jobId}</Ltr>}
            </h2>
            {job && (
              <div className="flex flex-wrap items-center gap-2">
                <JobStatusView job={job} />
                <JobReasonView words={jobStateWords(job)} />
              </div>
            )}
          </div>
          <IconButton label={t('drawer.close')} onClick={onClose} data-job-drawer-close="">
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-3">
          {read.isPending ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('drawer.loading')}
            </div>
          ) : notFound ? (
            <div className="flex flex-col gap-1 py-10 text-center" data-job-not-found="">
              <p className="text-sm font-semibold">{t('drawer.notFoundTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('drawer.notFoundHint')}</p>
            </div>
          ) : read.isError ? (
            <ErrorBanner className="p-3" message={apiErrorMessage(read.error, t('drawer.failed'))} />
          ) : (
            job && (
              <>
                <dl className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-6 gap-y-2 text-sm">
                  <div className="flex flex-col gap-0.5" data-field="target">
                    <dt className="text-xs text-muted-foreground">{t('drawer.target')}</dt>
                    <dd className="font-mono text-xs">
                      {job.target ? (
                        <Ltr>{job.target.database ? formatPair(job.target.server, job.target.database) : job.target.server}</Ltr>
                      ) : (
                        <span className="font-sans text-muted-foreground">{t('drawer.targetUnresolved')}</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5" data-field="attempts">
                    <dt className="text-xs text-muted-foreground">{t('drawer.attempts')}</dt>
                    <dd className="font-mono text-xs">
                      <Ltr>{groupDigits(job.attemptCount)}</Ltr>
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5" data-field="startedAt">
                    <dt className="text-xs text-muted-foreground">{t('campaign.startedAt')}</dt>
                    <dd className="font-mono text-xs">{job.startedAt ? <Ltr>{formatDateTime(job.startedAt)}</Ltr> : t('campaign.notYet')}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5" data-field="finishedAt">
                    <dt className="text-xs text-muted-foreground">{t('campaign.finishedAt')}</dt>
                    <dd className="font-mono text-xs">{job.finishedAt ? <Ltr>{formatDateTime(job.finishedAt)}</Ltr> : t('campaign.notYet')}</dd>
                  </div>
                </dl>
                {job.failureReason && (
                  <div data-job-failure="">
                    <FailureView kind="job" reason={job.failureReason} />
                  </div>
                )}

                <section className="flex flex-col gap-2" aria-label={t('drawer.tables')}>
                  <h3 className="text-xs font-semibold text-muted-foreground">{t('drawer.tables')}</h3>
                  {job.tableTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('drawer.noTables')}</p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-border/60" data-table-tasks-grid="">
                      <AgGridReact<TableTask>
                        theme={omsGridTheme}
                        rowData={job.tableTasks}
                        columnDefs={columns}
                        defaultColDef={DATA_SYNC_DEFAULT_COL_DEF}
                        getRowId={tableTaskId}
                        rowHeight={OMS_GRID_ROW_HEIGHT}
                        headerHeight={OMS_GRID_HEADER_HEIGHT}
                        domLayout="autoHeight"
                        animateRows={false}
                        suppressColumnVirtualisation
                      />
                    </div>
                  )}
                </section>

                {footer && (
                  <footer className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3" data-job-drawer-footer="">
                    {footer(job)}
                  </footer>
                )}
              </>
            )
          )}
        </div>
      </div>
    </dialog>
  )
}
