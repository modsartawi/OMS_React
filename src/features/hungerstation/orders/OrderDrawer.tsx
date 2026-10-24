import { useId, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AlertTriangle, FileJson, Loader2, RotateCw, X } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type {
  HungerStationOrderDelivery,
  HungerStationOrderDetail,
  HungerStationOrderLine,
  HungerStationOrderRow,
} from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import StatusBadge from '@/core/ui/StatusBadge'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure as figure } from '@/core/util/number-format'
import { orderKey, ordersApi } from './api'
import { AlertBadge, OutcomeBadge, StoreCode } from './columns'
import { orderMoney as money, storesPath } from './order-links'
import { lineOrder } from './order-lines'
import { alertLabel, runLabel } from './order-outcome'
import type { RawTarget } from './RawDrawer'
import type { RetryTarget } from './RetryDialog'

/** The fields a row and its detail share — what the header reads while the detail loads. */
type OrderFields = Omit<HungerStationOrderRow, 'deliveries'>

/**
 * **One HungerStation order** (ticket 556; contract § Orders monitor, `GET Orders/{orderId}`) — its
 * fields, its lines (each replacement right after the line it replaced, with HungerStation's line
 * status, money in the order's currency) and its deliveries oldest first, each with its run. An
 * `unmatched` order leads with its alert and the link to the Stores page. A delivery opens its raw
 * body; a `retryable` order offers Retry. The frame is the house side sheet.
 */
export default function OrderDrawer({
  row,
  linkStores,
  onClose,
  onRaw,
  onRetry,
}: {
  row: HungerStationOrderRow
  /** `canManageStores`: the store code links to its logs on the Stores page. */
  linkStores: boolean
  onClose: () => void
  onRaw: (target: RawTarget) => void
  onRetry: (target: RetryTarget) => void
}) {
  const { t } = useTranslation('hungerstation-orders')
  const titleId = useId()
  const detail = useQuery({
    queryKey: orderKey(row.orderId),
    queryFn: () => ordersApi.detail(row.orderId),
    retry: false,
  })
  // Until the detail answers, the row the grid holds speaks for it.
  const order: OrderFields = detail.data ?? row
  const alert = alertLabel(order.alert)

  return (
    <SideSheet onClose={onClose} width="w-[64rem]" aria-labelledby={titleId} data-order-drawer={row.orderId}>
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t('detail.eyebrow')}</span>
          <h2 id={titleId} className="text-sm font-semibold tracking-tight" data-order-title="">
            {/* A pair led by a machine value: one string, isolated once (bidi rule). */}
            <Ltr>{formatPair(order.chainKey, order.orderCode)}</Ltr>
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {order.retryable === true && (
            <Button variant="outlined" onClick={() => onRetry(order)} data-order-drawer-retry="">
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              {t('actions.retry')}
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('detail.close')}
            title={t('detail.close')}
            data-order-close=""
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
        {alert && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 px-3 py-2 text-[0.8125rem] text-attention-800"
            data-order-alert={order.alert ?? ''}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold">{t(alert.title)}</p>
              <p>{t(alert.hint)}</p>
              {alert.action && (
                <Link to={storesPath(order.vendorId)} className="font-medium underline underline-offset-2" data-order-drawer-stores-link={order.vendorId}>
                  {t(alert.action)}
                </Link>
              )}
            </div>
          </div>
        )}
        <Header order={order} linkStores={linkStores} />
        {detail.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-order-loading="">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('detail.loading')}
          </p>
        ) : detail.isError ? (
          <div data-order-error={apiErrorCode(detail.error) ?? ''}>
            <ErrorBanner className="p-3" title={t('detail.failed')} message={apiErrorMessage(detail.error, t('results.failed'))}>
              {apiErrorCode(detail.error) && (
                <span className="font-mono text-xs">
                  <Ltr>{apiErrorCode(detail.error)}</Ltr>
                </span>
              )}
            </ErrorBanner>
          </div>
        ) : (
          <>
            <Lines order={detail.data} />
            <Deliveries order={detail.data} onRaw={onRaw} />
          </>
        )}
      </div>
    </SideSheet>
  )
}

/** The order's own fields, label beside value. A `null` store or document is blank. */
function Header({ order, linkStores }: { order: OrderFields; linkStores: boolean }) {
  const { t } = useTranslation('hungerstation-orders')
  const field = (label: string, value: ReactNode, data: string) => (
    <div className="flex flex-col gap-0.5" data-order-field={data}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
  const code = (v: string | null) =>
    v ? (
      <span className="font-mono text-[12.5px]">
        <Ltr>{v}</Ltr>
      </span>
    ) : null
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border/60 p-3 md:grid-cols-4">
      {field(t('detail.orderId'), code(order.orderId), 'orderId')}
      {field(t('detail.orderCode'), code(order.orderCode), 'orderCode')}
      {field(t('detail.chain'), code(order.chainKey), 'chain')}
      {field(t('detail.vendorId'), code(order.vendorId), 'vendorId')}
      {field(
        t('detail.store'),
        order.storeCode ? (
          <span className="font-mono text-[12.5px]">
            <StoreCode code={order.storeCode} linked={linkStores} data="data-order-drawer-store-link" />
          </span>
        ) : null,
        'store',
      )}
      {field(t('detail.document'), code(order.documentNumber), 'document')}
      {field(t('detail.receivedAt'), <Ltr>{formatDateTime(order.receivedAt)}</Ltr>, 'receivedAt')}
      {field(t('detail.hsStatus'), code(order.hsStatus), 'hsStatus')}
      {field(
        t('detail.outcome'),
        <span className="flex flex-wrap items-center gap-1.5">
          <OutcomeBadge t={t} outcome={order.outcome} />
          <AlertBadge t={t} alert={order.alert} />
        </span>,
        'outcome',
      )}
      {field(
        t('detail.replacedLines'),
        <span className="tabular-nums">
          <Ltr>{figure(order.replacedLines)}</Ltr>
        </span>,
        'replacedLines',
      )}
      {field(
        t('detail.total'),
        <span className="tabular-nums">
          <Ltr>{money(order.total, order.currencyKey)}</Ltr>
        </span>,
        'total',
      )}
      <div className="col-span-full flex flex-col gap-0.5" data-order-field="reason">
        <dt className="text-xs text-muted-foreground">{t('detail.reason')}</dt>
        <dd className="text-sm">{order.reason ? <bdi>{order.reason}</bdi> : null}</dd>
      </div>
    </dl>
  )
}

/** The lines, each replacement right after the line it replaced. Money in the ORDER's currency. */
function Lines({ order }: { order: HungerStationOrderDetail }) {
  const { t } = useTranslation('hungerstation-orders')
  const lines = lineOrder(order.lines ?? [])
  const skuOf = new Map(lines.map((l) => [l.itemId, l.sku]))
  return (
    <section className="flex flex-col gap-2" data-order-lines="">
      <h3 className="text-xs font-semibold tracking-tight">{t('detail.lines')}</h3>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('detail.noLines')}</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="border-b border-border/60 text-muted-foreground">
            <tr>
              <th className={TH}>{t('detail.lineColumns.sku')}</th>
              <th className={TH}>{t('detail.lineColumns.name')}</th>
              <th className={TH}>{t('detail.lineColumns.status')}</th>
              <th className={TH + ' text-end'}>{t('detail.lineColumns.quantity')}</th>
              <th className={TH + ' text-end'}>{t('detail.lineColumns.unitPrice')}</th>
              <th className={TH + ' text-end'}>{t('detail.lineColumns.totalPrice')}</th>
              <th className={TH + ' text-end'}>{t('detail.lineColumns.discount')}</th>
              <th className={TH}>{t('detail.lineColumns.material')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <LineRow key={line.itemId} line={line} currencyKey={order.currencyKey} replacedSku={line.replacedId ? skuOf.get(line.replacedId) : undefined} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function LineRow({ line, currencyKey, replacedSku }: { line: HungerStationOrderLine; currencyKey: string; replacedSku: string | undefined }) {
  const { t } = useTranslation('hungerstation-orders')
  const replacement = replacedSku !== undefined
  return (
    <tr
      className={'border-b border-border/40 ' + (replacement ? 'bg-primary-050/40' : '')}
      data-order-line={line.itemId}
      data-order-line-replaces={line.replacedId ?? undefined}
    >
      <td className={TD + ' font-mono'}>
        {/* A replacement is indented under the line it replaced (logical padding, mirrors under RTL). */}
        <span className={replacement ? 'ps-4' : ''}>
          <Ltr>{line.sku}</Ltr>
        </span>
      </td>
      <td className="px-2 py-1.5 align-top">
        <span className="flex flex-col">
          <bdi>{line.name}</bdi>
          {replacement && (
            <span className="text-muted-foreground" data-order-line-replaced-sku="">
              <Trans t={t} i18nKey="detail.replaces" values={{ sku: replacedSku }} components={{ sku: <Ltr /> }} />
            </span>
          )}
        </span>
      </td>
      <td className={TD + ' font-mono'} data-order-line-status={line.status}>
        <Ltr>{line.status}</Ltr>
      </td>
      <td className={TD + ' text-end tabular-nums'}>
        <Ltr>{figure(line.quantity)}</Ltr>
      </td>
      <td className={TD + ' text-end tabular-nums'}>
        <Ltr>{money(line.unitPrice, currencyKey)}</Ltr>
      </td>
      <td className={TD + ' text-end tabular-nums'}>
        <Ltr>{money(line.totalPrice, currencyKey)}</Ltr>
      </td>
      <td className={TD + ' text-end tabular-nums'}>
        <Ltr>{money(line.discount, currencyKey)}</Ltr>
      </td>
      <td className={TD + ' font-mono'}>{line.materialNumber ? <Ltr>{line.materialNumber}</Ltr> : null}</td>
    </tr>
  )
}

/** The deliveries, oldest first, each with its run — and its raw body. */
function Deliveries({ order, onRaw }: { order: HungerStationOrderDetail; onRaw: (target: RawTarget) => void }) {
  const { t } = useTranslation('hungerstation-orders')
  // Oldest first, whatever order arrives: local wall-clock text sorts as time does.
  const deliveries = [...(order.deliveries ?? [])].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  return (
    <section className="flex flex-col gap-2" data-order-deliveries="">
      <h3 className="text-xs font-semibold tracking-tight">{t('detail.deliveries')}</h3>
      {deliveries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('detail.noDeliveries')}</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="border-b border-border/60 text-muted-foreground">
            <tr>
              <th className={TH}>{t('detail.deliveryColumns.receivedAt')}</th>
              <th className={TH}>{t('detail.deliveryColumns.run')}</th>
              <th className={TH + ' text-end'}>{t('detail.deliveryColumns.attempts')}</th>
              <th className={TH}>{t('detail.deliveryColumns.lastAttemptAt')}</th>
              <th className={TH}>{t('detail.deliveryColumns.nextAttemptAt')}</th>
              <th className={TH}>{t('detail.deliveryColumns.error')}</th>
              <th className={TH}>{t('detail.deliveryColumns.body')}</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <DeliveryRow key={d.receiveId} delivery={d} onRaw={() => onRaw({ orderId: order.orderId, orderCode: order.orderCode, receiveId: d.receiveId })} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function DeliveryRow({ delivery, onRaw }: { delivery: HungerStationOrderDelivery; onRaw: () => void }) {
  const { t } = useTranslation('hungerstation-orders')
  const run = delivery.run
  const label = runLabel(run)
  return (
    <tr className="border-b border-border/40" data-order-delivery={delivery.receiveId} data-order-run={run?.status ?? 'none'}>
      <td className={TD}>
        <Ltr>{formatDateTime(delivery.receivedAt)}</Ltr>
      </td>
      <td className="px-2 py-1.5 align-top" data-order-run-label="">
        <StatusBadge sev={label.sev}>{label.key ? t(label.key) : <Ltr>{label.raw}</Ltr>}</StatusBadge>
      </td>
      <td className={TD + ' text-end tabular-nums'} data-order-run-attempts="">
        {run && <Ltr>{figure(run.attempts)}</Ltr>}
      </td>
      <td className={TD} data-order-run-last="">
        {run?.lastAttemptAt && <Ltr>{formatDateTime(run.lastAttemptAt)}</Ltr>}
      </td>
      <td className={TD} data-order-run-next="">
        {/* Only a waiting run has a next attempt. */}
        {run?.status === 'P' && run.nextAttemptAt && <Ltr>{formatDateTime(run.nextAttemptAt)}</Ltr>}
      </td>
      <td className="px-2 py-1.5 align-top text-danger-800" data-order-run-error="">
        {run?.error ? <bdi>{run.error}</bdi> : null}
      </td>
      <td className={TD}>
        <Button variant="ghost" onClick={onRaw} data-order-raw={delivery.receiveId}>
          <FileJson className="h-3.5 w-3.5" aria-hidden />
          {t('actions.raw')}
        </Button>
      </td>
    </tr>
  )
}
