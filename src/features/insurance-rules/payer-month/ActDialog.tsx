import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import Ltr from '@/core/ui/Ltr'
import { formatCount, fsi } from '@/core/util/bidi'
import { REASON_MAX, actBody, periodText, reasonMeter, refusalKey, type ActTarget, type CloseAllOffer } from './payer-month-rules'

/**
 * The one ask before Close, Reopen or Close all (oms 896; BackOffice 1628, 1639, 1648). The **reason** is
 * required and counted against its column (512): Confirm stays disabled until `actBody` would build a body, so a
 * blank or over-long reason is never sent. Close all states its count, read from the activity list, and asks once.
 *
 * A refusal renders HERE, not as a toast: the modal is a native top-layer dialog, so a toast raised while it is
 * open would sit under the scrim (the undispense dialog's precedent). The dialog stays open beside it.
 */
export interface ActDialogProps {
  /** What the act is about; `null` = closed. */
  target: ActTarget | null
  /** Close all's statement (its count, the already-closed, the corrections); read with `target.kind === 'closeAll'`. */
  offer: CloseAllOffer | null
  busy: boolean
  error: unknown
  onClose: () => void
  onConfirm: (reason: string) => void
}

export default function ActDialog({ target, offer, busy, error, onClose, onConfirm }: ActDialogProps) {
  const { t } = useTranslation('insurance-payer-month')
  const [reason, setReason] = useState('')
  const meter = reasonMeter(reason)
  const ready = target !== null && !busy && actBody(target, reason) !== null
  const refusal = error ? refusalKey(error) : null
  const kind = target?.kind ?? 'close'
  const period = target ? fsi(periodText(target)) : ''
  const corrections = target?.kind === 'closeAll' ? (offer?.corrections ?? 0) : target ? (target.row.correctionCount ?? 0) : 0

  const titleKey = kind === 'closeAll' ? 'dialog.closeAllTitle' : kind === 'reopen' ? 'dialog.reopenTitle' : 'dialog.closeTitle'
  const confirmKey = kind === 'closeAll' ? 'dialog.confirmCloseAll' : kind === 'reopen' ? 'dialog.confirmReopen' : 'dialog.confirmClose'
  const hint = meter.blank ? t('dialog.reasonRequired') : meter.over ? t('dialog.reasonTooLong', { max: REASON_MAX }) : undefined

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={t(titleKey)}
      // Every open starts blank: the last payer's reason must not land on this one.
      onShow={() => setReason('')}
      width="32rem"
      dismissable={!busy}
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy}>
            {t('dialog.back')}
          </Button>
          <Button
            variant={kind === 'reopen' ? 'primary' : 'danger'}
            aria-disabled={!ready}
            title={hint}
            onClick={() => ready && onConfirm(reason)}
            data-testid="payer-month-confirm"
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {t(confirmKey)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-testid="payer-month-dialog">
        {/* Interpolated values are isolated whole with fsi (bidi rule). */}
        {target?.kind === 'closeAll' ? (
          <>
            <p>{t('dialog.closeAllBody', { count: target.count, period })}</p>
            {(offer?.alreadyClosed ?? 0) > 0 && (
              <p className="text-muted-foreground">{t('dialog.alreadyClosed', { count: offer!.alreadyClosed })}</p>
            )}
          </>
        ) : target ? (
          <p>{t(kind === 'reopen' ? 'dialog.reopenBody' : 'dialog.closeBody', { payer: fsi(target.row.customerId), period })}</p>
        ) : null}

        {kind !== 'reopen' && corrections > 0 && (
          <p className="rounded-md border border-attention-border bg-attention-050 p-2 text-attention-800" data-testid="payer-month-dialog-corrections">
            {t('dialog.corrections', { count: corrections })}
          </p>
        )}

        {error !== null && error !== undefined && (
          <ErrorBanner
            title={t('dialog.refused')}
            // The page's own sentence for a code it knows; the server's own otherwise.
            message={refusal ? t(refusal) : apiErrorMessage(error, t('dialog.refused'))}
            className="p-2"
          />
        )}

        <Field
          label={t('dialog.reason')}
          hint={
            <span className="flex justify-between gap-2">
              <span>{hint}</span>
              <span className={meter.over ? 'text-danger-800' : ''} data-testid="payer-month-reason-count">
                <Ltr>{formatCount(meter.length, meter.max)}</Ltr>
              </span>
            </span>
          }
          invalid={meter.over}
        >
          <Textarea
            rows={4}
            className="w-full"
            value={reason}
            placeholder={t('dialog.reasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
            dir="auto"
            data-testid="payer-month-reason"
          />
        </Field>
      </div>
    </Modal>
  )
}
