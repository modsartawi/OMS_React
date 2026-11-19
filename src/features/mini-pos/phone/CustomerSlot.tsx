import { useTranslation } from 'react-i18next'
import { UserRound } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import type { SessionState } from '@/core/models/callcenter'

/**
 * 🚩 THE CUSTOMER STEP'S SEAM (oms 917). The server refuses pricing until a loyalty member is attached
 * (`NO_CUSTOMER_ATTACHED`, BackOffice 4070), and taking the customer (mobile, Arbahi QR, sign-up) is ticket 917's.
 * Until then the basket shows who the server says is attached, and the refusal says the rest. 917 replaces this slot
 * with the step that finds and attaches the member, and puts it between the unlock and the basket in
 * `MiniPosPhonePage`'s flow.
 */
export default function CustomerSlot({ state }: { state: SessionState }) {
  const { t } = useTranslation('mini-pos-phone')
  const customer = state.header.customer
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
      <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">{t('basket.customer')}</span>
      {customer ? (
        <span className="ms-auto flex flex-col items-end">
          <bdi className="font-medium">{customer.name}</bdi>
          <span className="text-xs text-muted-foreground">
            <Ltr>{customer.mobile}</Ltr>
          </span>
        </span>
      ) : (
        <span className="ms-auto text-muted-foreground">{t('basket.noCustomer')}</span>
      )}
    </div>
  )
}
