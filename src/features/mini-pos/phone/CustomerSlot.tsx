import { useTranslation } from 'react-i18next'
import { UserRound } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import type { LoyaltyMember, SessionState } from '@/core/models/callcenter'

/**
 * The attached customer on the basket (oms 917): the member's name and mobile as the SESSION holds them
 * (`header.customer`, the server's word on who is on this order), and the tier from the member the phone found, when it
 * is the same member. A reopened order's customer was attached by the server, so it shows without a tier.
 */
export default function CustomerSlot({ state, member }: { state: SessionState; member: LoyaltyMember | null }) {
  const { t } = useTranslation('mini-pos-phone')
  const customer = state.header.customer
  const tier = customer && member && member.loyId === customer.customerId ? member.tier : null
  return (
    <div data-customer={customer?.customerId ?? ''} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
      <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">{t('basket.customer')}</span>
      {customer ? (
        <span className="ms-auto flex flex-col items-end">
          <bdi className="font-medium">{customer.name}</bdi>
          <span className="flex gap-2 text-xs text-muted-foreground">
            {tier && (
              <span data-tier>
                {t('basket.tier')} <bdi>{tier}</bdi>
              </span>
            )}
            <Ltr>{customer.mobile}</Ltr>
          </span>
        </span>
      ) : (
        <span className="ms-auto text-muted-foreground">{t('basket.noCustomer')}</span>
      )}
    </div>
  )
}
