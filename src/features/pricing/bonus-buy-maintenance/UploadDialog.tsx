import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import type { BbyUploadBonusBuy, BbyUploadRefusal } from '@/core/models/bonus-buy-upload'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { bbyMaintainApi } from './api'
import { overviewSeverity, overviewStatus, promotionPath } from './overview'
import {
  readUpload,
  UPLOAD_ACCEPT,
  UPLOAD_MAX_BYTES,
  uploadFileProblem,
  type UploadOptions,
  type UploadView,
} from './upload'

/**
 * SAP's bonus-buy upload, from the promotion screen (ticket 418, BackOffice 2381/2382).
 *
 * The file goes up as bytes: SAP's 22-column tab-separated file, unchanged except that its
 * `AKTNR` is a `P…` number. The door is all or nothing, so the answer is either the created
 * and updated `OMS…` numbers, or every refused row with nothing written. Only a load that
 * wrote refreshes the overview (`onLoaded`); a check-only run never does.
 */
export default function UploadDialog({
  open,
  promoNumber,
  onClose,
  onLoaded,
}: {
  open: boolean
  /** The promotion on screen. The file's `AKTNR` may name another one. */
  promoNumber: string
  onClose: () => void
  /** A load wrote: refresh the overview and the promotion the file loaded into. */
  onLoaded: (loadedPromoNumber: string) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const [file, setFile] = useState<File | null>(null)
  const [validateOnly, setValidateOnly] = useState(false)
  const [activate, setActivate] = useState(false)
  const [view, setView] = useState<UploadView | null>(null)
  const [fileName, setFileName] = useState('')

  // A fresh dialog per opening: a result left from an earlier file describes other bytes.
  useEffect(() => {
    if (!open) return
    setFile(null)
    setValidateOnly(false)
    setActivate(false)
    setView(null)
    setFileName('')
  }, [open])

  const run = useMutation({
    // The options travel with the call, so the reading uses what was SENT, not a box
    // ticked while the answer was on its way.
    mutationFn: ({ file, options }: { file: File; options: UploadOptions }) =>
      bbyMaintainApi.upload(file, options).then((result) => readUpload(result, options)),
    onSuccess: (next, { file }) => {
      setView(next)
      setFileName(file.name)
      if (next.refreshOverview) onLoaded(next.promoNumber || promoNumber)
    },
  })

  const problem = file ? uploadFileProblem(file) : null
  const canRun = !!file && !problem && !run.isPending

  const close = () => {
    // Not while the file is in flight: its answer would land in a dialog no one sees.
    if (run.isPending) return
    run.reset()
    onClose()
  }

  /** Back to the file step, keeping the options: a refused file is fixed and sent again. */
  const again = () => {
    setView(null)
    setFile(null)
    run.reset()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('upload.title')}
      width="56rem"
      footer={
        view ? (
          <>
            <Button variant="text" onClick={again}>
              {t('upload.again')}
            </Button>
            <Button variant="primary" onClick={close}>
              {t('upload.close')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" disabled={run.isPending} onClick={close}>
              {t('upload.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!canRun}
              onClick={() => file && run.mutate({ file, options: { validateOnly, activate } })}
            >
              {validateOnly ? t('upload.runCheck') : t('upload.run')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-region="bby-upload">
        {view ? (
          <UploadResult view={view} fileName={fileName} promoNumber={promoNumber} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{t('upload.hint')}</p>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {t('upload.file')}
              <input
                type="file"
                accept={UPLOAD_ACCEPT}
                data-testid="bby-upload-file"
                disabled={run.isPending}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  run.reset()
                }}
                className="rounded-md border border-border bg-card p-2 text-sm text-foreground file:me-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs"
              />
            </label>
            {problem && <ErrorBanner message={t(`upload.problem.${problem}`, { max: fsi(String(UPLOAD_MAX_BYTES / 1024 / 1024)) })} className="px-3 py-2" />}

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={validateOnly}
                disabled={run.isPending}
                data-testid="bby-upload-check-only"
                onChange={(e) => setValidateOnly(e.target.checked)}
              />
              <span>
                <span className="font-medium">{t('upload.checkOnly')}</span>
                <span className="block text-xs text-muted-foreground">{t('upload.checkOnlyHint')}</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={activate}
                disabled={run.isPending}
                data-testid="bby-upload-activate"
                onChange={(e) => setActivate(e.target.checked)}
              />
              <span>
                <span className="font-medium">{t('upload.activate')}</span>
                <span className="block text-xs text-muted-foreground">{t('upload.activateHint')}</span>
              </span>
            </label>

            {run.isPending && (
              <p className="text-xs text-muted-foreground" role="status">
                {t('upload.running')}
              </p>
            )}
            {/* A throw is infrastructure (a 413, the grant, the network): the door's own
                refusals arrive in-band, in the result. */}
            {run.isError && (
              <ErrorBanner message={apiErrorMessage(run.error, t('upload.failed'))} className="px-3 py-2" />
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

const RESULT_TITLE: Record<UploadView['outcome'], string> = {
  loaded: 'upload.result.loaded',
  checked: 'upload.result.checked',
  refused: 'upload.result.refused',
  unknown: 'upload.result.unknown',
}

function UploadResult({ view, fileName, promoNumber }: { view: UploadView; fileName: string; promoNumber: string }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const check = view.outcome === 'checked'
  const elsewhere = view.promoNumber !== '' && view.promoNumber !== promoNumber
  return (
    <>
      <div
        role="status"
        data-outcome={view.outcome}
        className={
          'rounded-lg border px-3 py-2 ' +
          (view.outcome === 'refused' || view.outcome === 'unknown'
            ? 'border-danger-border bg-danger-050 text-danger-800'
            : 'border-border/60 bg-card')
        }
      >
        <div className="font-medium">
          {t(RESULT_TITLE[view.outcome], { file: fsi(fileName), number: fsi(view.promoNumber) })}
        </div>
        {view.nothingWritten && (
          <div className="mt-0.5" data-testid="bby-upload-nothing-written">
            {t('upload.result.nothingWritten')}
          </div>
        )}
        {view.promotionCreated && view.outcome !== 'refused' && (
          <div className="mt-0.5">
            {t(check ? 'upload.result.promotionWouldBeCreated' : 'upload.result.promotionCreated', {
              number: fsi(view.promoNumber),
            })}
          </div>
        )}
        {elsewhere && view.outcome === 'loaded' && (
          <Link to={promotionPath(view.promoNumber)} className="mt-1 inline-block text-primary underline">
            {t('upload.result.openPromotion', { number: fsi(view.promoNumber) })}
          </Link>
        )}
      </div>

      {view.refused.length > 0 && (
        <MessageTable title={t('upload.refusedRows')} rows={view.refused} testId="bby-upload-refused" />
      )}
      {view.created.length > 0 && (
        <BonusBuyTable
          title={t(check ? 'upload.wouldCreate' : 'upload.created')}
          rows={view.created}
          testId="bby-upload-created"
        />
      )}
      {view.updated.length > 0 && (
        <BonusBuyTable
          title={t(check ? 'upload.wouldUpdate' : 'upload.updated')}
          rows={view.updated}
          testId="bby-upload-updated"
        />
      )}
      {view.warnings.length > 0 && (
        <MessageTable title={t('upload.warnings')} rows={view.warnings} testId="bby-upload-warnings" />
      )}
    </>
  )
}

const TH = 'px-2 py-1 text-start text-xs font-medium text-muted-foreground'
const TD = 'px-2 py-1 align-top'

function Section({ title, count, testId, children }: { title: string; count: number; testId: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1" data-testid={testId}>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {title}
        <span className="rounded-full bg-muted px-2 text-xs">
          <Ltr>{count}</Ltr>
        </span>
      </h3>
      <div className="max-h-64 overflow-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">{children}</table>
      </div>
    </section>
  )
}

function RowCell({ row }: { row: number }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  // Row 0 is the whole file, not a row (BbyUploadRefusal.OfFile).
  return <td className={TD}>{row === 0 ? t('upload.col.wholeFile') : <Ltr>{row}</Ltr>}</td>
}

function MessageTable({ title, rows, testId }: { title: string; rows: BbyUploadRefusal[]; testId: string }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <Section title={title} count={rows.length} testId={testId}>
      <thead className="bg-muted/40">
        <tr>
          <th className={TH}>{t('upload.col.row')}</th>
          <th className={TH}>{t('upload.col.serial')}</th>
          <th className={TH}>{t('upload.col.code')}</th>
          <th className={TH}>{t('upload.col.reason')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border/40">
            <RowCell row={r.row} />
            <td className={TD + ' font-mono'}>{r.serial && <Ltr>{r.serial}</Ltr>}</td>
            <td className={TD + ' font-mono text-xs'}>
              <Ltr>{r.code}</Ltr>
            </td>
            <td className={TD}>
              <bdi>{r.english}</bdi>
              {r.arabic && (
                <div className="text-muted-foreground">
                  <bdi dir="rtl">{r.arabic}</bdi>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Section>
  )
}

function BonusBuyTable({ title, rows, testId }: { title: string; rows: BbyUploadBonusBuy[]; testId: string }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <Section title={title} count={rows.length} testId={testId}>
      <thead className="bg-muted/40">
        <tr>
          <th className={TH}>{t('upload.col.bbyNumber')}</th>
          <th className={TH}>{t('upload.col.row')}</th>
          <th className={TH}>{t('upload.col.serial')}</th>
          <th className={TH}>{t('upload.col.buyGroup')}</th>
          <th className={TH}>{t('upload.col.getGroup')}</th>
          <th className={TH}>{t('upload.col.status')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const status = overviewStatus(r.bbyStatus)
          return (
            <tr key={i} className="border-t border-border/40">
              <td className={TD + ' font-mono'}>
                {r.bbyNumber ? <Ltr>{r.bbyNumber}</Ltr> : <span className="text-muted-foreground">{t('upload.col.new')}</span>}
              </td>
              <RowCell row={r.row} />
              <td className={TD + ' font-mono'}>
                <Ltr>{r.serial}</Ltr>
              </td>
              <td className={TD + ' font-mono'}>
                <Ltr>{r.buyGroup}</Ltr>
              </td>
              <td className={TD + ' font-mono'}>
                <Ltr>{r.getGroup}</Ltr>
              </td>
              <td className={TD}>
                <StatusBadge sev={overviewSeverity(status)}>{t(`overview.status.${status}`)}</StatusBadge>
              </td>
            </tr>
          )
        })}
      </tbody>
    </Section>
  )
}
