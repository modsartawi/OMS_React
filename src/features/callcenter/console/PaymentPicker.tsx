/**
 * PROTOTYPE (wayfinder ticket 176, drawing [155](.issues/155-payment-type-cod-or-online.md)) —
 * *how are they paying?*
 *
 * 🚩 **It is not a tender and no money moves here.** Owner ruling: nothing is
 * paid on the console. `Online` is an instruction to OMS to send the caller a
 * payment-gateway link, which they complete elsewhere — the console never sees a
 * gateway, a card, an amount or a result. That is why it creates no
 * price-affecting power (map note 4) and why it is a plain verb rather than a
 * `pendingConfirmation` kind: nothing is previewed, nothing re-prices, nothing
 * can refuse.
 *
 * 🚩 **The mode words the cash option; the wire never changes.** Under
 * `PickInStore` *Cash on delivery* describes an order nobody delivers, so the
 * option reads *Pay on collection* while `paymentType` stays `"CashOnDelivery"`
 * (§2.4). That is the sentence that makes 176 and 155 one drawing rather than
 * two.
 *
 * `Receivable` is on the contract and is **not drawn**: no phase-1 path produces
 * it and the server refuses it, so an option for it would be a control the door
 * refuses. It is named in the model so the day the business wants it is a data
 * change, not a §9 major.
 */
import { useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'
import type { PaymentType } from '@/core/models/callcenter'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { NOTE } from './console-notes'

const OFFERED: PaymentType[] = ['CashOnDelivery', 'Online']

export default function PaymentPicker({
  open,
  current,
  pickup,
  pending,
  error,
  onPick,
  onClose,
}: {
  open: boolean
  current: PaymentType
  /** Whether the order collects rather than delivers — it words the cash option
   *  and nothing else. Passed in rather than re-derived, so the chip and the
   *  modal cannot disagree about which word they are using. */
  pickup: boolean
  pending: PaymentType | null
  error: string | null
  onPick: (value: PaymentType) => void
  onClose: () => void
}) {
  const { t } = useTranslation('callcenter')
  const busy = pending !== null

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t('payment.title')}
      width="32rem"
      footer={
        <Button variant="text" onClick={onClose} disabled={busy} data-cc-payment-close>
          {t('payment.close')}
        </Button>
      }
    >
      <div className="space-y-2" data-cc-payment-picker>
        {OFFERED.map((value) => {
          const isCurrent = value === current
          const word =
            value === 'CashOnDelivery' ? (pickup ? 'payOnCollection' : 'cashOnDelivery') : 'paidOnline'
          return (
            <button
              key={value}
              type="button"
              onClick={() => onPick(value)}
              disabled={busy || isCurrent}
              data-cc-payment-option={value}
              className="flex w-full items-start gap-2 rounded-md border border-border bg-card p-3 text-start hover:bg-accent disabled:cursor-not-allowed disabled:hover:bg-card"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t(`payment.option.${word}.title`)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t(`payment.option.${word}.detail`)}
                </div>
              </div>
              {isCurrent && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] text-success-800"
                  data-cc-payment-current
                >
                  <Check className="h-3 w-3" aria-hidden />
                  {t('fulfilment.onThisOrder')}
                </span>
              )}
              {pending === value && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
              )}
            </button>
          )
        })}

        {error && (
          <p className={NOTE.danger} data-cc-payment-error>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
