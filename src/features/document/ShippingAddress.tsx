import { useTranslation } from 'react-i18next'
import type { SdDocumentAddressModel } from '@/core/models/sd-document'
import { shippingAddressRows } from './fields'
import FieldGroup from './FieldGroup'

/**
 * The Screen 2 "Shipping Address" group — the address as a field group (with an
 * "open in maps" row when the GPS pair is usable), or a short note when the
 * document carries none (e.g. a pick-in-store order).
 */
export default function ShippingAddress({
  address,
}: {
  address: SdDocumentAddressModel | null | undefined
}) {
  const { t } = useTranslation('document')
  const rows = shippingAddressRows(address, t)

  if (rows.length > 0) return <FieldGroup title={t('groups.shippingAddress')} fields={rows} />

  return (
    <section className="rounded-md border border-border bg-card">
      <h2 className="rounded-t-md border-b border-border bg-muted/60 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {t('groups.shippingAddress')}
      </h2>
      <p className="px-2.5 py-2 text-[0.8125rem] text-muted-foreground">{t('groups.noAddress')}</p>
    </section>
  )
}
