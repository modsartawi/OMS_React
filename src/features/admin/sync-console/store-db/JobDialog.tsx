import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { StoreDbJobAccepted, StoreDbJobKind } from '@/core/models/store-database'
import { notify } from '@/core/services/notify'
import Chip from '@/core/ui/Chip'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { AUDIT_KEY } from '../api'
import ReasonDialog from '../ReasonDialog'
import { storeDbApi, storeDbJobsKey } from './api'
import { jobRequest, refusalKey, runsTonightByDefault, type StoreDbJobExtra } from './job-helpers'

export interface JobDialogProps {
  /** The store the job runs on. */
  code: string
  /** The job to ask for; `null` = closed. */
  kind: StoreDbJobKind | null
  /** The field a kind needs (919: `file` for RestoreSideCopy, `database` for DropSideCopy). */
  extra?: StoreDbJobExtra
  /** Replaces the kind's own note (`storeDb.jobs.kinds.<Kind>.note`). */
  note?: string
  /** Shown above the reason (919: the side-copy name a restore will create). */
  children?: ReactNode
  onClose: () => void
  /** After the door accepted the job (the dialog has already toasted and closed). */
  onDone?: (accepted: StoreDbJobAccepted) => void
}

/**
 * Asks for one store database job (oms 918; BO 4034, spec D12) on the console's reason dialog: the reason is required,
 * a heavy kind (data shrink, side-copy restore / drop) waits for tonight's window unless **Run now** is chosen, and a
 * refusal shows the server's own text with its code while the dialog stays open. Kind-generic — 919 opens it for
 * RestoreSideCopy, DropSideCopy, InstallBlitz and RemoveBlitz. Success toasts when the job will start, then re-reads
 * the store's jobs and the console's audit.
 */
export default function JobDialog(props: JobDialogProps) {
  if (!props.kind) return null
  return <Ask key={props.kind} {...props} kind={props.kind} />
}

function Ask({ code, kind, extra, note, children, onClose, onDone }: JobDialogProps & { kind: StoreDbJobKind }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const tonight = runsTonightByDefault(kind)
  const [runNow, setRunNow] = useState(false)
  const label = t(`storeDb.jobs.kinds.${kind}.label`)

  const send = useMutation({
    mutationFn: (reason: string) => storeDbApi.requestJob(jobRequest(code, kind, reason, runNow, extra)),
    onSuccess: (accepted) => {
      notify.success(t('storeDb.jobs.dialog.queued', { kind: label, code: fsi(code), at: fsi(formatDateTime(accepted.notBefore)) }))
      if (accepted.warning) notify.warn(accepted.warning)
      void qc.invalidateQueries({ queryKey: storeDbJobsKey(code) })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      onDone?.(accepted)
      onClose()
    },
  })

  return (
    <ReasonDialog
      open
      title={t(`storeDb.jobs.kinds.${kind}.title`)}
      codes={[code]}
      note={note ?? t(`storeDb.jobs.kinds.${kind}.note`)}
      busy={send.isPending}
      error={send.error}
      codeLabel={refusalKey}
      confirmLabel={t(`storeDb.jobs.kinds.${kind}.confirm`)}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={() => !send.isPending && onClose()}
    >
      <div data-job-dialog={kind} className="contents">
        {children}
        {tonight && (
          <div className="flex flex-wrap items-center gap-2 text-xs" data-job-when={runNow ? 'now' : 'tonight'}>
            <Chip on={runNow} onClick={() => setRunNow((v) => !v)} disabled={send.isPending} data-job-run-now="">
              {t('storeDb.jobs.dialog.runNow')}
            </Chip>
            <span className="text-muted-foreground">{t(runNow ? 'storeDb.jobs.dialog.runsNow' : 'storeDb.jobs.dialog.runsTonight')}</span>
          </div>
        )}
      </div>
    </ReasonDialog>
  )
}
