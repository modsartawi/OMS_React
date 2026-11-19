import { useTranslation } from 'react-i18next'
import { ListOrdered, Pencil, RefreshCw } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { formatMoneyOfUnknownCurrency } from '@/core/money'
import type { MiniPosOrder } from './api'
import NoConnection from './NoConnection'
import RefusalBanner from './RefusalBanner'
import type { ShownRefusal } from './refusal'

const KNOWN_STATUSES = ['open', 'held', 'paid', 'closed']

/** An order may be offered for editing while it is open, or held (a till may let it go). Whether it really may be
 *  edited is the server's answer to the reopen: held, paid, closed and another pharmacy are refused there. */
export const offersEdit = (order: Pick<MiniPosOrder, 'status'>) => order.status === 'open' || order.status === 'held'

/** "08:41" from the server's local timestamp, as stamped (no zone conversion: the estate runs on one wall clock). */
const timeOf = (enteredAt: string) => /T(\d{2}:\d{2})/.exec(enteredAt)?.[1] ?? enteredAt

/**
 * My orders today (spec 4063 / 3708 R5, oms 929; BackOffice 4071): the promoter's own Mini POS orders of the day,
 * newest first, each with the status the server gives it. An open order can be reopened to edit it; the server refuses
 * the reopen while a till holds the order, once it is paid or closed, and while another basket is open, and that
 * refusal is shown here in its own words.
 */
export default function OrdersScreen({
  orders,
  loading,
  refusal,
  noConnection,
  reopening,
  onReopen,
  onRefresh,
  onBack,
}: {
  orders: MiniPosOrder[] | null
  loading: boolean
  refusal: ShownRefusal | null
  noConnection: boolean
  /** The document number being reopened, while its call is in flight. */
  reopening: string | null
  onReopen: (documentNo: string) => void
  onRefresh: () => void
  onBack: () => void
}) {
  const { t } = useTranslation('mini-pos-phone')
  return (
    <div className="flex flex-col gap-4" data-screen="orders">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <ListOrdered className="size-5" aria-hidden />
        {t('orders.title')}
      </h1>

      {noConnection && <NoConnection />}
      {refusal && <RefusalBanner refusal={refusal} />}

      {orders && orders.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('orders.none')}</p>}
      {!orders && loading && <p className="py-6 text-center text-sm text-muted-foreground">{t('app.working')}</p>}

      {orders && orders.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {orders.map((order) => (
            <li key={order.documentNo} data-order={order.documentNo} data-status={order.status} className="flex flex-col gap-2 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono font-semibold">
                  <Ltr>{order.documentNo}</Ltr>
                </span>
                <span className="font-mono">
                  <Ltr>{formatMoneyOfUnknownCurrency(order.netTotal)}</Ltr>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  <Ltr>{timeOf(order.enteredAt)}</Ltr>
                </span>
                <span data-status-label className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                  {KNOWN_STATUSES.includes(order.status) ? t(`orders.status.${order.status}`) : <Ltr>{order.status}</Ltr>}
                </span>
                {offersEdit(order) && (
                  <Button
                    variant="outlined"
                    className="ms-auto h-10"
                    disabled={!!reopening}
                    onClick={() => onReopen(order.documentNo)}
                  >
                    <Pencil className="size-4" aria-hidden />
                    {reopening === order.documentNo ? t('app.working') : t('orders.edit')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button variant="secondary" className="h-11 w-full justify-center" disabled={loading} onClick={onRefresh}>
        <RefreshCw className="size-4" aria-hidden />
        {t('orders.refresh')}
      </Button>
      <Button variant="outlined" className="h-11 w-full justify-center" disabled={!!reopening} onClick={onBack}>
        {t('orders.back')}
      </Button>
    </div>
  )
}
