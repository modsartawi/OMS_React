import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { DISMISS_NOTE_MAX, DISMISS_REASONS, type DismissAlertBody, type PriceAlertView } from '@/core/models/price-watch'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'
import { formatCount, fsi } from '@/core/util/bidi'
import { dismissBody, dismissProblem } from './alerts'

const NS = 'price-command-center'

/**
 * Dismiss a price alert (oms 934, BackOffice spec 4127): a reason is required, OTHER needs a note (`dismissProblem`, the
 * server's PWT-00036 / PWT-00037 rule checked before sending). WRONG_MATCH also breaks the product match, and the dialog
 * says so. A refusal stays in the dialog with its code, so the reason and note are not lost.
 *
 * Mounted only while open (keyed by the alert), so a fresh opening never carries the last dismissal's reason.
 */
export default function DismissDialog({
  alert,
  busy,
  error,
  onEdit,
  onConfirm,
  onClose,
}: {
  alert: PriceAlertView
  busy: boolean
  error: unknown
  /** The reason or note changed — the caller clears its last refusal. */
  onEdit: () => void
  onConfirm: (body: DismissAlertBody) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  // One send per Confirm: a second click before `busy` shows is ignored; editing opens the latch again.
  const sending = useRef(false)
  if (!busy && error != null) sending.current = false
  return (
    <DismissDialogView
      alert={alert}
      reason={reason}
      note={note}
      busy={busy}
      error={error}
      onReason={(r) => {
        setReason(r)
        sending.current = false
        onEdit()
      }}
      onNote={(n) => {
        setNote(n)
        sending.current = false
        onEdit()
      }}
      onConfirm={(body) => {
        if (sending.current) return
        sending.current = true
        onConfirm(body)
      }}
      onClose={onClose}
    />
  )
}

/** The dialog as drawn from its state — exported for the component test. */
export function DismissDialogView({
  alert,
  reason,
  note,
  busy,
  error,
  onReason,
  onNote,
  onConfirm,
  onClose,
}: {
  alert: PriceAlertView
  reason: string
  note: string
  busy: boolean
  error: unknown
  onReason: (reason: string) => void
  onNote: (note: string) => void
  onConfirm: (body: DismissAlertBody) => void
  onClose: () => void
}) {
  const { t } = useTranslation(NS)
  const problem = dismissProblem(reason, note)
  const ready = problem === null && !busy
  const code = error != null ? apiErrorCode(error) : null
  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      dismissable={!busy}
      title={t('dismiss.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy}>
            {t('dismiss.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={!ready}
            onClick={() => ready && problem === null && onConfirm(dismissBody(reason as DismissAlertBody['reason'], note))}
            data-dismiss-confirm=""
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('dismiss.sending') : t('dismiss.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-dismiss-dialog={alert.alertId}>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t('dismiss.note', { material: fsi(alert.materialNumber), competitor: fsi(alert.competitorCode) })}
        </p>
        <Field label={t('dismiss.reasonLabel')} hint={reason === 'WRONG_MATCH' ? t('dismiss.wrongMatchHint') : undefined}>
          <Select value={reason} onChange={(e) => onReason(e.target.value)} disabled={busy} required data-dismiss-reason="">
            <option value="">{t('dismiss.reasonPick')}</option>
            {DISMISS_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`dismiss.reason.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={
            <span className="flex items-baseline justify-between gap-2">
              {t('dismiss.noteLabel')}
              <span className="font-normal tabular-nums text-muted-foreground">
                <Ltr>{formatCount(note.trim().length, DISMISS_NOTE_MAX)}</Ltr>
              </span>
            </span>
          }
          hint={t('dismiss.noteHint')}
          error={problem === 'noteTooLong' ? t('dismiss.problem.noteTooLong', { max: fsi(String(DISMISS_NOTE_MAX)) }) : undefined}
        >
          <Textarea value={note} onChange={(e) => onNote(e.target.value)} rows={3} dir="auto" disabled={busy} className="w-full" data-dismiss-note="" />
        </Field>
        {problem !== null && problem !== 'noteTooLong' && (
          <p className="text-xs text-muted-foreground" data-dismiss-problem={problem}>
            {t(`dismiss.problem.${problem}`)}
          </p>
        )}
        {error != null && (
          <ErrorBanner className="p-2" title={t('alerts.decisionFailed')} message={apiErrorMessage(error, t('alerts.failedHint'))}>
            {code && (
              <span className="font-mono text-xs" data-dismiss-refusal={code}>
                <Ltr>{code}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}
