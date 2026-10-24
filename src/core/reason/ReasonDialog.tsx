import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatCount, fsi } from '@/core/util/bidi'
import { REASON_MAX, reasonField } from './reason'

/**
 * The write dialog of the delivery-rail areas, on the app modal — never a browser `confirm()`.
 * Built for Deliverect (spec 2615, ticket 477) and moved here by ticket 551 when HungerStation
 * (spec 3028) became its second user: both contracts make every write carry a reason, so each
 * area's writes compose it through a thin binding (`@/core/deliverect/ReasonDialog`,
 * `@/core/hungerstation/ReasonDialog`) that names the area's namespace and its reason refusal.
 * `children` is the room for the write's own fields above the reason, and `note` is the sentence
 * that says what the write does.
 *
 * The reason obeys `reasonField`: Confirm stays disabled until it holds 1–200 characters once
 * trimmed, and it is sent trimmed. The area's reason refusal (DLV-00009 / DHS-00008) shows inline
 * under the field. Any other refusal shows in the dialog with its code — unless the caller lists it
 * in `handledCodes` because it shows that refusal inline at its own field. The dialog stays open on
 * a refusal, so the reason is not lost.
 *
 * It speaks in `ns`, whose `reason.*` and `dialog.*` keys every binding's namespace carries.
 */
export interface ReasonDialogProps {
  open: boolean
  title: string
  /** What the write does, in a sentence. */
  note?: ReactNode
  busy: boolean
  /** The last failed send, if any. */
  error: unknown
  confirmLabel: string
  /** A terminal write (remove) confirms on the danger button. */
  danger?: boolean
  /** The caller's own gate on Confirm, on top of the reason (a required field still empty). */
  confirmDisabled?: boolean
  /** Refusal codes the caller shows inline at its own fields, so they are not shown twice. */
  handledCodes?: readonly string[]
  /** The reason was edited — the caller clears its last refusal (`mutation.reset`), so a corrected
   *  reason is not still marked with the refusal it was refused for. */
  onEdit?: () => void
  /** The reason, already trimmed. */
  onConfirm: (reason: string) => void
  onClose: () => void
  children?: ReactNode
}

export default function ReasonDialog({
  open,
  title,
  note,
  busy,
  error,
  confirmLabel,
  danger = false,
  confirmDisabled = false,
  handledCodes = [],
  onEdit,
  onConfirm,
  onClose,
  children,
  ns,
  reasonRefusal,
}: ReasonDialogProps & {
  /** The area's namespace — it carries `reason.*` and `dialog.*`. */
  ns: string
  /** The area's reason refusal: the server's sentence when the write was refused for its reason. */
  reasonRefusal: (err: unknown, fallback: string) => string | null
}) {
  const { t } = useTranslation(ns)
  const [text, setText] = useState('')
  const check = reasonField(text)
  const ready = check.problem === null && !busy && !confirmDisabled
  const code = error ? apiErrorCode(error) : null
  const reasonServer = reasonRefusal(error, t('dialog.failedHint'))
  const banner = error != null && reasonServer === null && !(code !== null && handledCodes.includes(code))

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      // A fresh opening never carries the last write's reason.
      onShow={() => setText('')}
      title={title}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-reason-cancel="">
            {t('dialog.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!ready}
            onClick={() => ready && onConfirm(check.reason)}
            data-reason-confirm=""
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('dialog.sending') : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-reason-dialog="">
        {note && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" data-reason-note="">
            {note}
          </p>
        )}
        {children}
        <label className="flex flex-col gap-1 text-xs font-medium">
          <span className="flex items-baseline justify-between gap-2">
            {t('reason.label')}
            <span
              className={'font-normal tabular-nums ' + (check.problem === 'tooLong' ? 'text-danger-800' : 'text-muted-foreground')}
              data-reason-count=""
            >
              <Ltr>{formatCount(check.length, REASON_MAX)}</Ltr>
            </span>
          </span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              onEdit?.()
            }}
            rows={3}
            required
            disabled={busy}
            dir="auto"
            aria-invalid={check.problem === 'tooLong' || reasonServer !== null || undefined}
            className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary/60"
            data-reason-input=""
          />
          <span className="font-normal text-muted-foreground">{t('reason.hint')}</span>
        </label>
        {check.problem === 'tooLong' && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-reason-too-long="">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('reason.tooLong', { max: fsi(String(REASON_MAX)) })}
          </p>
        )}
        {reasonServer !== null && <InlineRefusal message={reasonServer} code={code} />}
        {banner && (
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

/**
 * A refusal shown inline beside the field it is about — the server's own sentence
 * (`"<English> / <Arabic>"`, free text, so `<bdi>`) and its code. Exported so a write's own field
 * shows its refusal the same way the reason does.
 */
export function InlineRefusal({ message, code }: { message: string; code: string | null }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs text-danger-800" data-inline-refusal={code ?? ''}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        <bdi>{message}</bdi>
        {code && (
          <span className="ms-1.5 font-mono">
            <Ltr>{code}</Ltr>
          </span>
        )}
      </span>
    </p>
  )
}
