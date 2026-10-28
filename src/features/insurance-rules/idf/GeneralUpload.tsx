import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { CheckCheck, FileUp, Loader2, Upload } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { TD, TH } from '@/core/insurance-rules/parts'
import { IDF_GENERAL_KEY, idfGeneralUploadApi } from './api'
import { EXCEPTION_REASON_MAX, reasonProblem } from './exceptions'
import {
  failedBatchLines,
  IDF_GENERAL_CHANGE_KINDS,
  isGeneralUploadApplicable,
  previewRows,
  previewSide,
  type IdfGeneralApplyResult,
  type IdfGeneralChangeKind,
  type IdfGeneralPreview,
  type IdfGeneralUploadReport,
} from './general-upload'
import { IDF_UPLOAD_ACCEPT, ruleWordKey, rowMessage } from './upload'
import UploadRowReport from './UploadRowReport'

/**
 * The General master page's **Upload** (BackOffice spec 3185, door 3193; oms ticket 649). A bad general file reaches
 * every till, so nothing is written until a clean check is confirmed: pick a file → Upload and check (writes nothing)
 * → a failing file shows 622's row report and Apply stays off; a clean one shows the change preview — added /
 * re-ranked / moved / unchanged, filterable, each change before → after. **Apply…** asks for a reason; the result
 * says how many items were written and lists any failed batch with its lines and message. The general items re-read.
 *
 * 🚩 UNGATED until 654 adds the general-edit probe.
 */
export default function GeneralUpload() {
  const { t } = useTranslation('insurance-idf')
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<IdfGeneralApplyResult | null>(null)
  const upload = useMutation({ mutationFn: (f: File) => idfGeneralUploadApi.upload(f) })
  const report = upload.data ?? null
  const applicable = isGeneralUploadApplicable(report)
  return (
    <div className="flex max-w-5xl flex-col gap-3 rounded-md border border-border/60 bg-card p-3" data-idf-general-upload="">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileUp className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('generalUpload.title')}
      </div>
      <p className="text-xs text-muted-foreground">{t('generalUpload.hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept={IDF_UPLOAD_ACCEPT}
          aria-label={t('generalUpload.file')}
          data-idf-general-upload-file=""
          className="text-sm"
          onChange={(e) => {
            upload.reset()
            setResult(null)
            setFile(e.target.files?.[0] ?? null)
          }}
        />
        <Button
          variant="secondary"
          data-idf-general-upload-submit=""
          disabled={!file || upload.isPending}
          onClick={() => {
            if (!file) return
            setResult(null)
            upload.mutate(file)
          }}
        >
          {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
          {t('generalUpload.submit')}
        </Button>
      </div>
      {upload.isError && (
        <div data-idf-general-upload-refused="">
          <ErrorBanner message={apiErrorMessage(upload.error, t('generalUpload.uploadFailed'))} />
        </div>
      )}
      {report && <UploadRowReport report={report} kind="item" applicable={applicable} ruleWordKey={ruleWordKey} keyPrefix="generalUpload" />}
      {report && applicable && report.preview && <Preview preview={report.preview} />}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={!applicable} data-idf-general-upload-apply="" onClick={() => setConfirming(true)}>
          <CheckCheck className="h-3.5 w-3.5" aria-hidden />
          {t('generalUpload.apply')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('generalUpload.applyHint')}</p>
      </div>
      {result && <Result result={result} />}
      {confirming && report && (
        <ApplyDialog
          report={report}
          onClose={() => setConfirming(false)}
          onApplied={async (res) => {
            setConfirming(false)
            setResult(res)
            upload.reset()
            await qc.invalidateQueries({ queryKey: IDF_GENERAL_KEY })
          }}
        />
      )}
    </div>
  )
}

/** The clean file's change preview: a chip per kind (with its count) filters the table of changes. */
function Preview({ preview }: { preview: IdfGeneralPreview }) {
  const { t } = useTranslation('insurance-idf')
  const [kind, setKind] = useState<IdfGeneralChangeKind | ''>('')
  const rows = previewRows(preview, kind)
  const count = (k: IdfGeneralChangeKind | '') => (k ? preview[k] : preview.added + preview.reRanked + preview.moved + preview.unchanged)
  return (
    <div className="flex flex-col gap-2" data-idf-general-preview="">
      <p className="text-sm font-medium">{t('generalUpload.previewTitle')}</p>
      <div className="flex flex-wrap gap-1" role="group" aria-label={t('generalUpload.filterLabel')} data-idf-general-preview-kinds="">
        {(['', ...IDF_GENERAL_CHANGE_KINDS] as const).map((k) => (
          <Chip key={k || 'all'} on={kind === k} data-kind={k || 'all'} data-count={count(k)} onClick={() => setKind(k)}>
            {t(`generalUpload.kind.${k || 'all'}`)} <Ltr>{formatFigure(count(k))}</Ltr>
          </Chip>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-idf-general-preview-empty="">
          {t('generalUpload.noChanges')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm" data-idf-general-preview-rows="">
            <thead className="bg-muted/50">
              <tr>
                <th className={TH}>{t('generalUpload.columns.item')}</th>
                <th className={TH}>{t('generalUpload.columns.change')}</th>
                <th className={TH}>{t('generalUpload.columns.before')}</th>
                <th className={TH}>{t('generalUpload.columns.after')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const before = previewSide(c.before)
                return (
                  <tr key={c.itemNumber} className="border-t border-border/60" data-item={c.itemNumber} data-change={c.change}>
                    <td className={TD} data-col="item">
                      <Ltr>{c.itemNumber}</Ltr>
                    </td>
                    <td className={TD} data-col="change">
                      {t(`generalUpload.kind.${c.change}`, { defaultValue: c.change })}
                    </td>
                    <td className={TD} data-col="before">
                      {before ? <Ltr>{before}</Ltr> : <span className="text-muted-foreground">{t('generalUpload.notRanked')}</span>}
                    </td>
                    <td className={TD} data-col="after">
                      <Ltr>{previewSide(c.after)}</Ltr>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Apply asks for a reason; a refused apply stays in the dialog as the server's message. */
function ApplyDialog({ report, onClose, onApplied }: { report: IdfGeneralUploadReport; onClose: () => void; onApplied: (r: IdfGeneralApplyResult) => void }) {
  const { t } = useTranslation('insurance-idf')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const problem = reasonProblem(reason)
  const apply = useMutation({
    mutationFn: () => idfGeneralUploadApi.apply(report.uploadId, reason.trim()),
    onSuccess: (res) => {
      notify.success(t('generalUpload.applied'), t('generalUpload.appliedDetail', { n: fsi(formatFigure(res.applied)) }))
      onApplied(res)
    },
  })
  return (
    <Modal
      open
      onClose={onClose}
      width="30rem"
      title={t('generalUpload.applyTitle')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('generalUpload.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={apply.isPending}
            data-idf-general-upload-confirm=""
            onClick={() => {
              setTried(true)
              if (!problem) apply.mutate()
            }}
          >
            {apply.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {t('generalUpload.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-general-upload-dialog="">
        <p className="text-sm">{t('generalUpload.applyLede')}</p>
        <Field
          label={t('generalUpload.reason')}
          error={
            tried && problem ? (
              <span role="alert" data-problem={problem}>
                {t(`generalUpload.problem.${problem}`)}
              </span>
            ) : undefined
          }
        >
          <Textarea className="h-20" dir="auto" maxLength={EXCEPTION_REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} data-field="reason" />
        </Field>
        {apply.isError && (
          <div data-idf-general-upload-apply-refused="">
            <ErrorBanner message={apiErrorMessage(apply.error, t('generalUpload.applyFailed'))} />
          </div>
        )}
      </div>
    </Modal>
  )
}

/** What the apply wrote, and each batch it could not write (its lines as one range, its message). */
function Result({ result }: { result: IdfGeneralApplyResult }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const failed = result.failedBatches
  return (
    <div className="flex flex-col gap-2" data-idf-general-upload-result="" data-applied={result.applied} data-failed={failed.length}>
      <p className="text-sm">
        <Trans t={t} i18nKey="generalUpload.result" values={{ n: formatFigure(result.applied) }} components={{ v: <Ltr /> }} />
      </p>
      {failed.length > 0 && (
        <>
          <p className="text-sm text-destructive" data-idf-general-upload-batches-summary="">
            <Trans t={t} i18nKey="generalUpload.batchesFailed" count={failed.length} values={{ n: formatFigure(failed.length) }} components={{ v: <Ltr /> }} />
          </p>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm" data-idf-general-upload-batches="">
              <thead className="bg-muted/50">
                <tr>
                  <th className={TH}>{t('generalUpload.batchColumns.lines')}</th>
                  <th className={TH}>{t('generalUpload.batchColumns.message')}</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((b) => (
                  <tr key={`${b.fromLine}-${b.toLine}`} className="border-t border-border/60" data-from={b.fromLine} data-to={b.toLine}>
                    <td className={`${TD} tabular-nums`} data-col="lines">
                      <Ltr>{failedBatchLines(b)}</Ltr>
                    </td>
                    <td className={TD} data-col="message">
                      <bdi>{rowMessage(b, i18n.language)}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
