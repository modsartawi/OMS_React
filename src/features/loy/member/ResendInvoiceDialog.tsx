import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ApiError } from '@/core/api'
import type { LoyInvoiceRow } from '@/core/models/loy'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { memberCommandKey } from './api'
import { recipientSourceKey } from './invoice-columns'
import { requeueInvoice, requeueOutcome } from './invoice-resend'
import MemberCommandDialog from './MemberCommandDialog'
import { commandRefusalText } from './member-commands'

/**
 * The **Resend** confirmation (ticket 428, spec 2443) — puts one receipt's invoice
 * email back on the rail's queue, in the `MemberCommandDialog` ceremony every member
 * command wears.
 *
 * It names the receipt and **the address it will go to**, so the agent can read it
 * back to the customer before pressing anything (story 7) — and for an e-commerce
 * receipt it says that address is the online order's, not the profile's (story 8).
 *
 * 🚩 **No case reference** (owner ruling, story 24): the most common call-centre
 * request stays one click after the profile fix. 🚩 **In-flight disable is the only
 * double-submit guard** on this side; the server's conditional reset is what makes a
 * double click or two agents produce one requeue, and it answers `AlreadyQueued`.
 *
 * A refusal (not this member's receipt, never queued, too old, an address the rail
 * would skip) is drawn inside the dialog by `commandRefusalText`, in the server's own
 * words, so the agent learns which field to fix (stories 13–14).
 */
export default function ResendInvoiceDialog({
  loyId,
  receipt,
  onClose,
}: {
  loyId: string
  receipt: LoyInvoiceRow
  onClose: () => void
}) {
  const { t } = useTranslation('loy')
  const queryClient = useQueryClient()
  const commandKey = memberCommandKey(loyId, 'requeue-invoice')

  const run = useMutation({
    mutationKey: commandKey,
    // The invalidation rides inside the command (`requeueInvoice`), not here.
    mutationFn: () => requeueInvoice(queryClient, loyId, receipt),
    onSuccess: (answer) => {
      const outcome = requeueOutcome(answer)
      // The server's address, isolated whole: a toast is a string-only sink (bidi).
      const say = outcome.recipient
        ? t(outcome.key, { recipient: fsi(outcome.recipient) })
        : t(outcome.key)
      if (answer.result === 'AlreadyQueued') toast.info(say)
      else toast.success(say)
      onClose()
    },
  })

  const busy = useIsMutating({ mutationKey: commandKey }) > 0
  // A grant refusal takes the command away, not only the words (the other commands' rule).
  const grantRefused = run.error instanceof ApiError && run.error.statusCode === 403
  const source = recipientSourceKey(receipt)

  return (
    <MemberCommandDialog
      title={t('tabs.invoices.resend.dialogTitle')}
      busy={busy}
      cannotConfirm={busy || grantRefused}
      confirmLabel={t('tabs.invoices.resend.confirm')}
      cancelLabel={t('tabs.invoices.resend.cancel')}
      confirmTestId="loy-invoice-resend-confirm"
      error={run.isError ? commandRefusalText(run.error, t('tabs.invoices.resend.failed'), t) : null}
      onClose={() => {
        run.reset()
        onClose()
      }}
      onConfirm={() => run.mutate()}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-muted-foreground">{t('tabs.invoices.resend.receipt')}</dt>
        <dd className="font-mono" data-testid="loy-invoice-resend-receipt">
          {/* `store · receipt`, one value isolated once (bidi). */}
          <Ltr>{formatPair(receipt.storeCode, receipt.trxNumber)}</Ltr>
        </dd>
        <dt className="text-muted-foreground">{t('tabs.invoices.resend.recipient')}</dt>
        <dd data-testid="loy-invoice-resend-recipient">
          {receipt.recipient ? <Ltr>{receipt.recipient}</Ltr> : t('tabs.invoices.noRecipient')}
          {source && <span className="ms-1.5 text-xs text-muted-foreground">{t(source)}</span>}
        </dd>
      </dl>
      <p className="text-muted-foreground">{t('tabs.invoices.resend.note')}</p>
    </MemberCommandDialog>
  )
}
