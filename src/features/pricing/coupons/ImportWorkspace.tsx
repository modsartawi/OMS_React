import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, Loader2, RotateCw, Trash2, Upload } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import { notify } from '@/core/services/notify'
import { type ImportJob, type ImportJobStatus, isTerminalJob } from '@/core/models/coupons'
import { fsi } from '@/core/util/bidi'
import { downloadCsv } from '@/core/util/download-file'
import { couponsApi } from './api'
import DeleteJobDialog from './DeleteJobDialog'
import {
  describeImportSummary,
  formatStamp,
  importResultCsv,
  importResultFileName,
  ImportParseError,
  isolatedCount,
  jobActions,
  MAX_CODES,
  MAX_LINE_LENGTH,
  parseImportText,
  summarizeImportResult,
} from './helpers'

// Import workspace (ticket 522): client-parse preview + JSON submit (519) + a jobs grid
// that self-updates via polling. The browser parses the .txt/.csv EXACTLY like the server
// ImportFileParser (see helpers.parseImportText) and shows a preview modal ("N codes, M
// duplicates skipped") before commit — refusing a >100k file client-side with split
// guidance. On confirm it POSTs { codes[], customerId? }; the server re-dedupes + re-caps
// as the backstop. The jobs query polls at ~2s ONLY while a job is non-terminal.
//
// Spec 2463 (ticket 439): a finished row also offers Delete (DeleteJobDialog); a Deleted row stays
// in the grid, greyed, with who deleted it and when, and offers nothing. Which row offers what is
// `jobActions`.
//
// Ticket 440 (spec 2463 amendment): every row that is no longer running also offers Download
// result, a CSV of what the upload did with each code (BackOffice 2477). A result rebuilt from
// today's coupons (a job older than SIS.Coupons.Core 1.0.8) is still saved, after a toast says so.

interface Preview {
  fileName: string
  codes: string[]
  duplicates: number
}

export default function ImportWorkspace() {
  const { t } = useTranslation('coupons')
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [templateId, setTemplateId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /** A queue call that failed while the preview modal is open — said inside it, which
   *  stays open (spec 380 F18: a toast under an open `showModal()` cannot be reached). */
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ImportJob | null>(null)

  const templateKey = templateId.trim()
  const jobsKey = ['coupons', 'jobs', templateKey] as const

  // Poll ONLY while a job is still in flight (Pending/Processing) — the interval disarms
  // itself the moment every job is Completed/Failed (ticket 522).
  const jobs = useQuery({
    queryKey: jobsKey,
    queryFn: () => couponsApi.jobsByTemplate(templateKey),
    enabled: templateKey.length > 0,
    refetchInterval: (query) => {
      const data = query.state.data as ImportJob[] | undefined
      return data && data.some((j) => !isTerminalJob(j.status)) ? 2000 : false
    },
  })

  function pickFile() {
    fileRef.current?.click()
  }

  async function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset the input so choosing the SAME file again re-fires onChange.
    e.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const { codes, duplicates } = parseImportText(text, file.name)
      if (codes.length === 0) {
        notify.warn(t('import.errors.empty'))
        return
      }
      setSubmitError(null)
      setPreview({ fileName: file.name, codes, duplicates })
    } catch (err) {
      if (err instanceof ImportParseError) {
        notify.error(
          err.kind === 'lineTooLong'
            ? t('import.errors.lineTooLong', { line: err.line, max: MAX_LINE_LENGTH })
            : t('import.errors.overCap', { max: MAX_CODES.toLocaleString() }),
        )
      } else {
        notify.error(t('import.errors.readFailed'))
      }
    }
  }

  async function confirmImport() {
    if (!preview || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await couponsApi.createImportJob(templateKey, {
        codes: preview.codes,
        customerId: customerId.trim() || null,
      })
      notify.success(t('import.submitted', { count: preview.codes.length }))
      setPreview(null)
      // Refetch so the new Pending row appears (and re-arms the poll).
      await queryClient.invalidateQueries({ queryKey: jobsKey })
    } catch (err) {
      // 404 unknown/disabled template, 409 CUP-09043 over-cap backstop, etc.
      setSubmitError(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function retry(jobId: string) {
    if (retryingId) return
    setRetryingId(jobId)
    try {
      await couponsApi.retryJob(jobId)
      notify.success(t('import.retried'))
      await queryClient.invalidateQueries({ queryKey: jobsKey })
    } catch (err) {
      // A non-failed job → 409 CUP-09042 (a race: it already flipped).
      notify.apiError(t('import.retryFailed'), err)
    } finally {
      setRetryingId(null)
    }
  }

  async function downloadResult(jobId: string) {
    if (downloadingId) return
    setDownloadingId(jobId)
    try {
      const result = await couponsApi.jobResult(jobId)
      if (result.reconstructed) {
        notify.warn(t(result.status === 'Deleted' ? 'import.result.reconstructedDeleted' : 'import.result.reconstructed'))
      }
      downloadCsv(importResultFileName(result), importResultCsv(result, t))
      notify.success(
        t('import.result.saved', { count: result.lines.length, n: isolatedCount(result.lines.length) }),
        describeImportSummary(summarizeImportResult(result), t).join('\n'),
      )
    } catch (err) {
      // 404 unknown job; 409 still running (a race: the grid had not caught up).
      notify.apiError(t('import.result.failed'), err)
    } finally {
      setDownloadingId(null)
    }
  }

  const rows = jobs.data ?? []

  return (
    <div className="flex flex-col gap-4">
      {/* Target template + optional customer + file picker */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card p-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('import.templateId')}
          <input
            type="text"
            className={inputCls}
            value={templateId}
            placeholder={t('import.templatePlaceholder')}
            maxLength={26}
            onChange={(e) => setTemplateId(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('import.customerId')}
          <input
            type="text"
            className={inputCls}
            value={customerId}
            placeholder={t('import.customerPlaceholder')}
            maxLength={26}
            onChange={(e) => setCustomerId(e.target.value)}
          />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv"
          className="hidden"
          onChange={(e) => void onFileChosen(e)}
        />
        <Button variant="primary" onClick={pickFile} disabled={!templateKey}>
          <Upload className="h-3.5 w-3.5" />
          {t('import.chooseFile')}
        </Button>
      </div>

      {!templateKey ? (
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          {t('import.enterTemplateHint')}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t('import.parseHint', { max: MAX_CODES.toLocaleString() })}</p>

          {/* Jobs grid */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">{t('import.jobs.title')}</h2>
            {jobs.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />}
          </div>

          {jobs.isError ? (
            <ErrorBanner message={t('import.jobs.loadFailed')} className="p-3" />
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              {jobs.isPending ? t('import.jobs.loading') : t('import.jobs.empty')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-start text-xs uppercase tracking-wide text-muted-foreground">
                    <Th>{t('import.jobs.col.job')}</Th>
                    <Th>{t('import.jobs.col.status')}</Th>
                    <Th className="text-end">{t('import.jobs.col.total')}</Th>
                    <Th className="text-end">{t('import.jobs.col.added')}</Th>
                    <Th className="text-end">{t('import.jobs.col.skipped')}</Th>
                    <Th>{t('import.jobs.col.when')}</Th>
                    <Th className="text-end">{t('import.jobs.col.actions')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((job) => {
                    const actions = jobActions(job.status)
                    const deleted = job.status === 'Deleted'
                    return (
                      <tr
                        key={job.jobId}
                        className={`border-b border-border/40 last:border-0 ${deleted ? 'text-muted-foreground opacity-70' : ''}`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{job.jobId}</td>
                        <td className="px-3 py-2">
                          <StatusPill status={job.status} label={t(`import.status.${job.status}`)} />
                          {job.status === 'Failed' && job.errorMessage ? (
                            <div className="mt-0.5 text-xs text-danger-800">{job.errorMessage}</div>
                          ) : null}
                          {deleted ? (
                            <div className="mt-0.5 text-xs">
                              {t('import.jobs.deletedBy', {
                                at: fsi(formatStamp(job.deletedAt)),
                                by: fsi(job.deletedBy ?? '—'),
                              })}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums">{job.totalCodes}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{job.totalAdded}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{job.totalSkipped}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{formatStamp(job.createdAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            {actions.download && (
                              <Button
                                variant="outlined"
                                onClick={() => void downloadResult(job.jobId)}
                                disabled={downloadingId !== null}
                              >
                                {downloadingId === job.jobId ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                {t('import.result.download')}
                              </Button>
                            )}
                            {actions.retry && (
                              <Button
                                variant="outlined"
                                onClick={() => void retry(job.jobId)}
                                disabled={retryingId !== null || deleting !== null}
                              >
                                {retryingId === job.jobId ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCw className="h-3.5 w-3.5" />
                                )}
                                {t('import.jobs.retry')}
                              </Button>
                            )}
                            {actions.delete && (
                              <Button
                                variant="outlined"
                                onClick={() => setDeleting(job)}
                                disabled={deleting !== null || retryingId === job.jobId}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t('import.jobs.delete')}
                              </Button>
                            )}
                            {!actions.download && !actions.retry && !actions.delete && <span className="text-muted-foreground">—</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <DeleteJobDialog
        job={deleting}
        onClose={() => setDeleting(null)}
        onSettled={() => queryClient.invalidateQueries({ queryKey: jobsKey })}
      />

      {/* Preview + commit modal */}
      <Modal
        open={preview !== null}
        onClose={() => !submitting && setPreview(null)}
        title={t('import.preview.title')}
        width="26rem"
        footer={
          <>
            <Button variant="text" onClick={() => setPreview(null)} disabled={submitting}>
              {t('import.preview.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void confirmImport()} disabled={submitting}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('import.preview.commit')}
            </Button>
          </>
        }
      >
        {preview && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="truncate font-mono text-xs text-muted-foreground">{preview.fileName}</div>
            <div className="flex gap-4">
              <div>
                <div className="text-2xl font-semibold tabular-nums">{preview.codes.length.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{t('import.preview.codesFound')}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums text-muted-foreground">
                  {preview.duplicates.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">{t('import.preview.duplicatesSkipped')}</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('import.preview.into', { id: templateKey })}
              {customerId.trim() ? ` · ${t('import.preview.customer', { id: customerId.trim() })}` : ''}
            </p>
            {submitError !== null && (
              <ErrorBanner
                title={t('import.submitFailed')}
                message={apiErrorMessage(submitError, t('import.submitFailed'))}
                className="p-2.5"
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

const inputCls =
  'w-56 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary'

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className}`}>{children}</th>
}

const PILL: Record<ImportJobStatus, string> = {
  Pending: 'bg-attention-050 text-attention-800',
  Processing: 'bg-primary-050 text-primary-800',
  Completed: 'bg-success-050 text-success-800',
  Failed: 'bg-danger-050 text-danger-800',
  Deleted: 'bg-muted text-muted-foreground line-through',
}

function StatusPill({ status, label }: { status: ImportJobStatus; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${PILL[status]}`}>{label}</span>
  )
}
