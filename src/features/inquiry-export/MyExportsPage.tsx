import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, RefreshCw } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { InquiryExportJob } from '@/core/inquiry-export/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatRange } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { saveBlob } from '@/core/util/download-file'
import { INQUIRY_EXPORT_JOBS_KEY, inquiryExportApi } from './api'
import { STATUS_SEV, jobFile, refreshEvery } from './jobs'

/**
 * **My exports** (BackOffice spec 4314, ticket 4318) at `/collection/exports` and `/oms/exports` — one page, linked
 * from both menus. It lists the caller's own export jobs (the server answers no one else's): screen, range, state,
 * rows, the cut flag, times, and the file — a download while it is kept, "file removed" once the sweeper took it. It
 * re-reads every few seconds while any job is waiting or running.
 *
 * No screen gate: every row is the caller's own and the doors are owner-scoped; the menu offers the page only while
 * the feature is on and the session may export something.
 *
 * Slots kept for 4320: a Cancel button on a Waiting row (beside the File cell) and the "Cancelled" state, already
 * worded in both languages.
 */
export default function MyExportsPage() {
  const { t } = useTranslation('inquiry-export')
  const jobs = useQuery({
    queryKey: INQUIRY_EXPORT_JOBS_KEY,
    queryFn: () => inquiryExportApi.myJobs(),
    refetchInterval: (q) => refreshEvery(q.state.data),
  })

  return (
    <div className="flex flex-col gap-3" data-my-exports="">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('page.subtitle')}</p>
        </div>
        <Button variant="outlined" onClick={() => void jobs.refetch()} disabled={jobs.isFetching}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          {t('page.refresh')}
        </Button>
      </div>
      {jobs.isError && <ErrorBanner message={apiErrorMessage(jobs.error, t('page.loadFailed'))} className="p-3" />}
      {jobs.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('page.loading')}
        </p>
      ) : jobs.data && jobs.data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-export-none="">
          {t('page.none')}
        </p>
      ) : jobs.data ? (
        <JobsTable jobs={jobs.data} />
      ) : null}
    </div>
  )
}

const COLUMNS = ['job', 'screen', 'range', 'state', 'rows', 'requested', 'finished', 'file'] as const

function JobsTable({ jobs }: { jobs: InquiryExportJob[] }) {
  const { t } = useTranslation('inquiry-export')

  const download = async (job: InquiryExportJob) => {
    try {
      const file = await inquiryExportApi.file(job.jobId)
      saveBlob(file.filename ?? job.fileName, file.blob)
    } catch (err) {
      notify.error(t('page.downloadFailed'), apiErrorMessage(err, t('page.removedHint')))
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 text-start font-medium">
                {t(`page.col.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const file = jobFile(job)
            return (
              <tr key={job.jobId} className="border-t border-border/60 align-top" data-export-job={job.jobId} data-export-status={job.status}>
                <td className="px-3 py-2 font-mono text-xs">
                  <Ltr>{job.jobNumber}</Ltr>
                </td>
                <td className="px-3 py-2">{t(`screens.${job.screen}`, { defaultValue: job.screen })}</td>
                <td className="px-3 py-2">
                  {job.fromDate === null ? (
                    // BackOffice 4323: a job read without a range (one ACR's Cash Collections).
                    <span data-export-undated="">{t('page.noRange')}</span>
                  ) : (
                    <Ltr>{formatRange(formatDay(job.fromDate), formatDay(job.toDate))}</Ltr>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge sev={STATUS_SEV[job.status]}>{t(`status.${job.status}`)}</StatusBadge>
                  {job.status === 'Failed' && (
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground" data-export-failed="">
                      {t('page.failedHint')}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  {job.status === 'Done' && <Ltr>{job.rowCount.toLocaleString('en-US')}</Ltr>}
                  {job.isCut && (
                    <p className="mt-1 max-w-xs text-xs text-attention-800" data-export-cut="" title={t('page.cutHint')}>
                      {t('page.cut', { rows: job.rowCount.toLocaleString('en-US') })}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Ltr>{formatDateTime(job.addedTime)}</Ltr>
                </td>
                <td className="px-3 py-2">
                  <Ltr>{formatDateTime(job.processedTime)}</Ltr>
                </td>
                <td className="px-3 py-2">
                  {file === 'download' ? (
                    <Button variant="secondary" onClick={() => void download(job)} data-export-download="">
                      <Download className="size-3.5" aria-hidden />
                      {t('page.download')}
                    </Button>
                  ) : file === 'removed' ? (
                    <span className="text-xs text-muted-foreground" data-export-removed="" title={t('page.removedHint')}>
                      {t('page.removed')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('page.noFile')}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
