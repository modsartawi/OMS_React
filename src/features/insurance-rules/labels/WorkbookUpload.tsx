import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Upload } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { ByAt, TD, TH } from '@/core/insurance-rules/parts'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { LABELS_KEY, labelsApi } from './api'
import {
  LABEL_CHANGES,
  WORKBOOK_KINDS,
  groupLabelDiff,
  type ChangeLogRow,
  type LabelChange,
  type LabelDiffRow,
  type LabelText,
  type WorkbookUploadReply,
} from './labels'

/** The upload card (ticket 706), and under it what the last upload changed. The reply is held until the next upload. */
export default function WorkbookUpload() {
  const { t } = useTranslation('insurance-labels')
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const upload = useMutation({
    mutationFn: (f: File) => labelsApi.upload(f),
    onSuccess: async ({ load }) => {
      notify.success(t('upload.done'), t('upload.doneDetail', { version: fsi(load.version) }))
      setFile(null)
      if (input.current) input.current.value = ''
      await queryClient.invalidateQueries({ queryKey: LABELS_KEY })
    },
  })
  return (
    <>
      <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-card p-3" data-upload="">
        <div className="text-sm font-medium">{t('upload.title')}</div>
        <p className="text-xs text-muted-foreground">{t('upload.hint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept=".xlsx,.xls"
            aria-label={t('upload.file')}
            data-upload-file=""
            className="text-sm"
            onChange={(e) => {
              if (upload.isError) upload.reset()
              setFile(e.target.files?.[0] ?? null)
            }}
          />
          <Button variant="primary" data-upload-submit="" disabled={!file || upload.isPending} onClick={() => file && upload.mutate(file)}>
            {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
            {t('upload.submit')}
          </Button>
        </div>
        {upload.isError && (
          <div data-upload-refused="">
            <ErrorBanner
              className="p-3"
              message={isBareDenial(upload.error) ? t('access.deniedTitle') : apiErrorMessage(upload.error, t('upload.failed'))}
            />
          </div>
        )}
      </div>
      {upload.data && <UploadResult reply={upload.data} />}
    </>
  )
}

/** A workbook's name in the screen's words; a kind this screen does not know stays as the door sent it. */
export function WorkbookName({ kind }: { kind: string }) {
  const { t } = useTranslation('insurance-labels')
  return (WORKBOOK_KINDS as readonly string[]).includes(kind) ? <>{t(`workbook.${kind}`)}</> : <Ltr>{kind}</Ltr>
}

function UploadResult({ reply }: { reply: WorkbookUploadReply }) {
  const { t } = useTranslation('insurance-labels')
  const { load } = reply
  const groups = groupLabelDiff(reply.diff ?? [])
  const changeLog = reply.changeLog ?? []
  return (
    <section className="flex flex-col gap-4 rounded-md border border-border/60 bg-card p-3" data-upload-result="">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <h2 className="font-semibold" data-result-workbook="">
          <WorkbookName kind={load.workbook} />
        </h2>
        <span data-result-version="">
          {t('result.version')} <Ltr>{load.version}</Ltr>
        </span>
        <span className="text-xs text-muted-foreground" data-result-uploaded="">
          <ByAt by={load.uploadedBy} at={load.uploadedAt} />
        </span>
      </div>

      <div className="flex flex-col gap-2" data-label-diff="">
        <h3 className="text-sm font-semibold">{t('diff.title')}</h3>
        {groups.total === 0 ? (
          <p className="text-sm text-muted-foreground" data-diff-empty="">
            {t('diff.empty')}
          </p>
        ) : (
          LABEL_CHANGES.map((change) => groups[change].length > 0 && <DiffGroup key={change} change={change} rows={groups[change]} />)
        )}
      </div>

      <div className="flex flex-col gap-2" data-change-log="">
        <h3 className="text-sm font-semibold">{t('changeLog.title')}</h3>
        {changeLog.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-change-log-empty="">
            {t('changeLog.empty')}
          </p>
        ) : (
          <ChangeLogTable rows={changeLog} />
        )}
      </div>
    </section>
  )
}

function DiffGroup({ change, rows }: { change: LabelChange; rows: LabelDiffRow[] }) {
  const { t } = useTranslation('insurance-labels')
  return (
    <div className="flex flex-col gap-1" data-diff-group={change}>
      <h4 className="text-xs font-medium">
        {t(`diff.${change}`)} <Ltr>{rows.length}</Ltr>
      </h4>
      {change === 'removed' && <p className="text-xs text-muted-foreground">{t('diff.removedHint')}</p>}
      <div className="max-h-96 overflow-auto rounded-md border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className={TH}>{t('diff.system')}</th>
              <th className={TH}>{t('diff.code')}</th>
              {change !== 'added' && <th className={TH}>{t('diff.before')}</th>}
              {change !== 'removed' && <th className={TH}>{t('diff.after')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.system}|${row.code}`} className="border-t border-border/60" data-diff-row={row.code}>
                <td className={`${TD} break-all text-xs`} data-col="system">
                  <Ltr>{row.system}</Ltr>
                </td>
                <td className={TD} data-col="code">
                  <Ltr>{row.code}</Ltr>
                </td>
                {change !== 'added' && (
                  <td className={TD} data-col="before">
                    <Label text={row.before} />
                  </td>
                )}
                {change !== 'removed' && (
                  <td className={TD} data-col="after">
                    <Label text={row.after} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** A code's English and Arabic labels, as sent, each its own line. */
export function Label({ text }: { text?: LabelText | null }) {
  const { t } = useTranslation('insurance-labels')
  if (!text?.en && !text?.ar) return <span className="text-muted-foreground">{t('diff.noLabel')}</span>
  return (
    <div className="flex flex-col">
      {text.en && (
        <span data-label="en">
          <bdi>{text.en}</bdi>
        </span>
      )}
      {text.ar && (
        <span data-label="ar">
          <bdi>{text.ar}</bdi>
        </span>
      )}
    </div>
  )
}

function ChangeLogTable({ rows }: { rows: ChangeLogRow[] }) {
  const { t } = useTranslation('insurance-labels')
  return (
    <div className="max-h-96 overflow-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className={TH}>{t('changeLog.version')}</th>
            <th className={TH}>{t('changeLog.date')}</th>
            <th className={TH}>{t('changeLog.system')}</th>
            <th className={TH}>{t('changeLog.code')}</th>
            <th className={TH}>{t('changeLog.change')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border/60" data-change-log-row="">
              <td className={TD} data-col="version">
                <Ltr>{row.version}</Ltr>
              </td>
              <td className={TD} data-col="date">
                {row.date && <Ltr>{row.date}</Ltr>}
              </td>
              <td className={`${TD} break-all text-xs`} data-col="system">
                {row.system && <Ltr>{row.system}</Ltr>}
              </td>
              <td className={TD} data-col="code">
                {row.code && <Ltr>{row.code}</Ltr>}
              </td>
              <td className={TD} data-col="change">
                <bdi>{row.change}</bdi>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
