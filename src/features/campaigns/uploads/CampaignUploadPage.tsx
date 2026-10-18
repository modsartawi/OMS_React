import { useId, useRef, useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Download, FileText, Loader2, Upload } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleUploadReport } from '@/core/models/rule-upload'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { saveBlob } from '@/core/util/download-file'
import { campaignUploadApi, campaignUploadPath } from './api'
import ReadReport from './ReadReport'
import { readReportView, type ReadReportView } from './report'

/**
 * Campaigns ▸ Campaign upload (ticket 530; BackOffice ADR 0097, brief 2839's U1): a marketer gets
 * the template, fills one workbook for one **deal**, uploads it, and reads what HQ made of it.
 *
 * The decided rules: all or none (one error refuses the whole file and stores nothing); a valid
 * read IS the approval request — there is no request door, the Note is a row of the workbook, and
 * the success state says "waiting for approval" at its revision; one pending upload per deal; no
 * campaign of an upload is edited here.
 *
 * Ticket 531 (brief 2839's U2) adds the second way to get a workbook: SAP's BBy `.txt` is never
 * uploaded, it is CONVERTED into ours, which the author reviews, completes and uploads in step 2.
 * The conversion stores nothing and its notes live only in the workbook, so after one the screen
 * says what to do next, in words, and shows nothing else.
 *
 * Three doors, `Uploads/Template` (03), `Uploads/ConvertBby` (02) and `Uploads/Read` (02). No access
 * probe exists: a bare 403 on any reads "You do not have access to this action", never an empty
 * report. A 401 is core's.
 */
export default function CampaignUploadPage() {
  const { t } = useTranslation('campaign-uploads')
  const fileId = useId()
  const [file, setFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const bbyInput = useRef<HTMLInputElement>(null)

  const template = useMutation({
    mutationFn: campaignUploadApi.template,
    onSuccess: ({ blob, fileName }) => saveBlob(fileName, blob),
  })
  const convert = useMutation({
    mutationFn: campaignUploadApi.convertBby,
    onSuccess: ({ blob, fileName }) => saveBlob(fileName, blob),
  })
  const read = useMutation({ mutationFn: campaignUploadApi.read })

  return (
    <section className="flex w-full max-w-7xl flex-col gap-5" data-campaign-upload="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
      </header>

      <Step n={1} title={t('template.title')} hint={t('template.hint')}>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => template.mutate()} disabled={template.isPending} data-upload-template="">
            {template.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
            {template.isPending ? t('template.downloading') : t('template.download')}
          </Button>
          <Button variant="secondary" onClick={() => bbyInput.current?.click()} disabled={convert.isPending} data-upload-convert="">
            {convert.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <FileText className="size-3.5" aria-hidden />}
            {convert.isPending ? t('convert.converting') : t('convert.pick')}
          </Button>
          <input
            ref={bbyInput}
            type="file"
            accept=".txt"
            className="sr-only"
            tabIndex={-1}
            aria-label={t('convert.file')}
            data-upload-bby-file=""
            onChange={(e) => {
              const picked = e.target.files?.[0]
              // Cleared at once, so picking the same .txt again (after fixing it) fires a change.
              e.target.value = ''
              if (picked) convert.mutate(picked)
            }}
          />
        </div>
        {template.isError && (
          <div data-upload-template-error="">
            <Failure error={template.error} fallback={t('template.failed')} />
          </div>
        )}
        {convert.isSuccess && (
          <div role="status" className="flex flex-col gap-1 rounded-md border border-border bg-muted p-3 text-sm" data-upload-converted="">
            <p className="font-medium">
              <Trans t={t} i18nKey="convert.saved" values={{ fileName: convert.data.fileName }} components={{ file: <Ltr /> }} />
            </p>
            <p data-upload-next-step="">{t('convert.next')}</p>
            <p className="text-xs text-muted-foreground">{t('convert.stored')}</p>
          </div>
        )}
        {convert.isError && (
          // 400 RULES_BAD_UPLOAD: the file could not be converted at all — the server's message, no next step.
          <div data-upload-convert-error="">
            <Failure error={convert.error} fallback={t('convert.failed')} />
          </div>
        )}
      </Step>

      <Step n={2} title={t('upload.title')} hint={t('upload.hint')}>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!file) return
            read.mutate(file)
            // Each upload takes a fresh pick: the fix is the same file saved again, and a browser
            // fires no change for the same path still in the box, so the old handle would be sent.
            setFile(null)
            if (fileInput.current) fileInput.current.value = ''
          }}
        >
          <label htmlFor={fileId} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('upload.file')}
            <input
              id={fileId}
              ref={fileInput}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={read.isPending}
              data-upload-file=""
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                read.reset()
              }}
              className="rounded-md border border-border bg-card p-2 text-sm text-foreground file:me-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs"
            />
          </label>
          <Button type="submit" disabled={!file || read.isPending} data-upload-send="">
            {read.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
            {t('upload.send')}
          </Button>
        </form>
        {read.isPending && (
          <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground" data-upload-busy="">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t('upload.reading')}
          </p>
        )}
        {read.isError && (
          // 400 RULES_BAD_UPLOAD: the file could not be read at all — the message, and nothing else.
          <div data-upload-refusal="">
            <Failure error={read.error} fallback={t('upload.failed')} />
          </div>
        )}
      </Step>

      {read.isSuccess && <Outcome report={read.data} />}
    </section>
  )
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4" data-upload-step={n}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-xs" aria-hidden>
          <Ltr>{n}</Ltr>
        </span>
        {title}
      </h2>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children}
    </section>
  )
}

/** A door's refusal: a bare 403 in our words, anything else in the server's. */
function Failure({ error, fallback }: { error: unknown; fallback: string }) {
  const { t } = useTranslation('campaign-uploads')
  const denied = isBareDenial(error)
  return (
    <span data-upload-denied={denied ? '' : undefined}>
      <ErrorBanner className="px-3 py-2" message={denied ? t('denied') : apiErrorMessage(error, fallback)} />
    </span>
  )
}

/** The state line the read earns, then its report. */
function Outcome({ report }: { report: RuleUploadReport }) {
  const view = readReportView(report)
  return (
    <div className="flex flex-col gap-4" data-upload-outcome={view.state}>
      <StateLine view={view} />
      <ReadReport report={report} view={view} />
    </div>
  )
}

function StateLine({ view }: { view: ReadReportView }) {
  const { t } = useTranslation('campaign-uploads')
  if (view.state === 'refused')
    return (
      <div role="alert" className="rounded-lg border-2 border-danger-border bg-danger-050 p-4 text-base font-semibold text-danger-800" data-upload-all-or-none="">
        <Trans t={t} i18nKey="outcome.refused" count={view.errorCount} components={{ n: <Ltr /> }} />
      </div>
    )
  if (view.state === 'unstored')
    return (
      <p className="rounded-lg border border-border bg-muted p-4 text-sm" data-upload-unstored="">
        {t('outcome.unstored')}
      </p>
    )
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-success-border bg-success-050 p-4 text-success-800" data-upload-waiting="">
      <p className="text-base font-semibold">
        <Trans
          t={t}
          i18nKey="outcome.waiting"
          values={{ deal: view.dealCode, revision: view.revision }}
          components={{ deal: <Ltr />, rev: <Ltr /> }}
        />
      </p>
      {view.note && (
        <p className="text-sm" data-upload-waiting-note="">
          <span className="font-medium">{t('outcome.note')}</span>{' '}
          <bdi>{view.note}</bdi>
        </p>
      )}
      <Link to={campaignUploadPath(view.dealCode)} className="w-fit text-sm font-medium text-primary hover:underline" data-upload-open="">
        {t('outcome.open')}
      </Link>
    </div>
  )
}
