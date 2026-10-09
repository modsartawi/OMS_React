import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { cleanReason, reasonReady } from './control-helpers'

/**
 * The ONE reason dialog of the console (spec 444, ticket 447), on the app modal —
 * never a browser `confirm()`. Every control opens it: 448's Cancel and Re-push and
 * 449's Dismiss / Edit store / Edit location reuse or compose it (`children` is the
 * room for their own fields above the reason).
 *
 * The reason is required: Confirm stays disabled until it holds something other
 * than white space, and it is sent trimmed. A whole-request refusal from the door
 * (`REASON_REQUIRED`, `TOO_MANY_STORES`, …) shows here through `apiErrorMessage`,
 * with its code, and the dialog stays open so the reason is not lost.
 */
export default function ReasonDialog({
  open,
  title,
  codes,
  note,
  busy,
  error,
  confirmLabel,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean
  title: string
  /** The stores (or ids) the action reaches, listed under the title. */
  codes?: readonly string[]
  /** What the action does, in a sentence, when it has one. */
  note?: string
  busy: boolean
  /** The last failed send, if any. */
  error: unknown
  confirmLabel?: string
  /** The reason, already trimmed. */
  onConfirm: (reason: string) => void
  onClose: () => void
  children?: ReactNode
}) {
  const { t } = useTranslation('sync-console')
  const [reason, setReason] = useState('')
  const ready = reasonReady(reason) && !busy
  const code = error ? apiErrorCode(error) : null

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      // A fresh opening never carries the last action's reason — for a caller that keeps
      // the dialog mounted and toggles `open` (ControlDialog unmounts it instead).
      onShow={() => setReason('')}
      title={title}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-reason-cancel="">
            {t('dialog.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!ready}
            onClick={() => ready && onConfirm(cleanReason(reason))}
            data-reason-confirm=""
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('dialog.sending') : (confirmLabel ?? t('dialog.confirm'))}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-reason-dialog="">
        {codes && codes.length > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">{t('dialog.stores')} </span>
            {/* One list of machine codes, isolated once as a whole. */}
            <span className="font-mono [overflow-wrap:anywhere]" data-reason-codes="">
              <Ltr>{codes.join(t('list.separator'))}</Ltr>
            </span>
          </div>
        )}
        {note && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{note}</p>}
        {children}
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t('dialog.reason')}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            required
            disabled={busy}
            className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary/60"
            data-reason-input=""
          />
        </label>
        {error != null && (
          <ErrorBanner className="p-2" title={t('dialog.failed')} message={apiErrorMessage(error, t('dialog.failedHint'))}>
            {code && (
              <span className="font-mono text-xs" data-reason-error={code}>
                <Ltr>{code}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}
