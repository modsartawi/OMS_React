import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { isGrantRefused } from './api'
import { RaiseButton, ReasonField, useRaiseCentralInvoice } from './raise'
import VerdictBadge from './VerdictBadge'

/**
 * *Central invoice…* on a delivery's page (ticket 332): a required reason, one POST for
 * this delivery, and the server's verdict shown in place — *queued*, *wait* or *refused*,
 * with its code and its sentence verbatim.
 *
 * In `core/` beside the probe and the call it uses, the way `core/attachments` holds the
 * panel the document page renders: the words are the `central-invoice` namespace's, so the
 * dialog and the bulk screen say the same thing about the same verdict.
 *
 * The one-send and 403 rules are `useRaiseCentralInvoice`'s. On top of them the dialog
 * cannot be dismissed while a request is in flight, so an answer is never dropped on the
 * floor, and a 403 closes it with a toast (the action it was opened from is gone).
 */
export default function CentralInvoiceDialog({
  open,
  onClose,
  deliveryNo,
}: {
  open: boolean
  onClose: () => void
  deliveryNo: string
}) {
  const { t } = useTranslation('central-invoice')
  const [reason, setReason] = useState('')
  const { mutation: raise, send } = useRaiseCentralInvoice(() => {
    notify.error(t('grantRefused.title'), t('grantRefused.detail'))
    onClose()
  })

  const trimmed = reason.trim()
  // One delivery sent, so one answer back — matched by number rather than by position.
  const answer = raise.data ? (raise.data.find((r) => r.deliveryNo === deliveryNo) ?? raise.data[0] ?? null) : null
  const answered = raise.isSuccess

  // Nothing dismisses the dialog mid-flight: the answer is the whole point of opening it.
  // The request is cleared on the way OUT, not only on the next open: `onShow` runs after
  // the first paint, so a reopened dialog would otherwise flash the last verdict.
  const close = () => {
    if (raise.isPending) return
    setReason('')
    raise.reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('dialog.title', { deliveryNo })}
      width="30rem"
      // A fresh request on every open: a reason or a verdict left over from the last one
      // would be one careless click from being read as this one's.
      onShow={() => {
        setReason('')
        raise.reset()
      }}
      footer={
        answered ? (
          <Button variant="primary" onClick={close}>
            {t('dialog.close')}
          </Button>
        ) : (
          <>
            <Button variant="text" disabled={raise.isPending} onClick={close}>
              {t('dialog.cancel')}
            </Button>
            <RaiseButton
              count={1}
              pending={raise.isPending}
              disabled={!trimmed}
              onClick={() => send({ deliveryNos: [deliveryNo], reason: trimmed })}
            />
          </>
        )
      }
    >
      {answered ? (
        answer ? (
          <div className="flex flex-col gap-2" data-central-invoice-answer={answer.verdict}>
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={answer.verdict} />
              {answer.code && <span className="font-mono text-xs text-muted-foreground">{answer.code}</span>}
            </div>
            {/* The server's sentence, verbatim — it may carry a line of Arabic under the English. */}
            <p className="whitespace-pre-line text-[0.8125rem]">{answer.message}</p>
          </div>
        ) : (
          <ErrorBanner className="p-2.5" message={t('dialog.noAnswer')} />
        )
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-[0.8125rem] text-muted-foreground">{t('dialog.intro')}</p>
          <ReasonField
            id="central-invoice-reason"
            value={reason}
            onChange={setReason}
            disabled={raise.isPending}
            rows={3}
          />
          {raise.isError && !isGrantRefused(raise.error) && (
            <ErrorBanner
              className="p-2.5"
              title={t('send.failedTitle')}
              message={apiErrorMessage(raise.error, t('send.failed'))}
            />
          )}
        </div>
      )}
    </Modal>
  )
}
