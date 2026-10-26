import { useId, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AlertOctagon, FileJson, Loader2, RotateCw, X } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { DeliverectOrderDetail, DeliverectOrderLine, DeliverectOrderRow, DeliverectOrderStatusSent } from '@/core/models/deliverect'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import SideSheet from '@/core/ui/SideSheet'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure as figure, formatMoney3 } from '@/core/util/number-format'
import { orderKey, ordersApi } from './api'
import { NeedsPerson, OutcomeBadge, statusText } from './columns'
import { documentPath, needsPerson, retryOffered, statusLabel } from './order-status'

/** Money with its currency — one machine value, isolated once by the caller. */
const money = (amount: number, currencyKey: string) => `${formatMoney3(amount)} ${currencyKey}`

/**
 * **One Deliverect order** (ticket 478; contract § Orders monitor, `GET Orders/{id}`) — its header,
 * the link to our document, its lines (a dropped line marked, with its reason) and every status we
 * sent Deliverect, in words, with Deliverect's answer and the attempts. A 126 (a cancel after
 * invoicing) leads with the alert: it needs a person. The raw body and, for a refused or
 * status-failed order only, Retry open over it.
 *
 * The frame is the house side sheet, `@/core/ui/SideSheet` (graduated by ticket 556). It reads the
 * door when it opens.
 */
export default function OrderDrawer({
  row,
  onClose,
  onRaw,
  onRetry,
}: {
  row: DeliverectOrderRow
  onClose: () => void
  onRaw: (row: DeliverectOrderRow) => void
  onRetry: (row: DeliverectOrderRow) => void
}) {
  const { t } = useTranslation('deliverect-orders')
  const titleId = useId()
  const detail = useQuery({
    queryKey: orderKey(row.deliverectOrderId),
    queryFn: () => ordersApi.detail(row.deliverectOrderId),
    retry: false,
  })
  // Until the detail answers, the row the grid holds speaks for it.
  const order: DeliverectOrderRow = detail.data ?? row

  return (
    <SideSheet onClose={onClose} width="w-[60rem]" aria-labelledby={titleId} data-order-drawer={row.deliverectOrderId}>
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t('detail.eyebrow')}</span>
          <h2 id={titleId} className="text-sm font-semibold tracking-tight" data-order-title="">
            {/* A pair led by a machine value: one string, isolated once (bidi rule). */}
            <Ltr>{formatPair(order.platformKey, order.channelDisplayId)}</Ltr>
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={() => onRaw(order)} data-order-raw="">
            <FileJson className="h-3.5 w-3.5" aria-hidden />
            {t('actions.raw')}
          </Button>
          {retryOffered(order.outcome) && (
            <Button variant="outlined" onClick={() => onRetry(order)} data-order-drawer-retry="">
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              {t('actions.retry')}
            </Button>
          )}
          <IconButton label={t('detail.close')} onClick={onClose} data-order-close="">
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
        {needsPerson(order.lastStatusSent) && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-050 px-3 py-2 text-[0.8125rem] text-danger-800"
            data-order-alert=""
          >
            <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{t('alert.title')}</p>
              <p>{t('alert.hint')}</p>
            </div>
          </div>
        )}
        <Header order={order} />
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
            <Statuses statuses={detail.data.statuses ?? []} />
          </>
        )}
      </div>
    </SideSheet>
  )
}

/** The order's own fields, label beside value. */
function Header({ order }: { order: DeliverectOrderRow }) {
  const { t } = useTranslation('deliverect-orders')
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
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border/60 p-3 md:grid-cols-3">
      {field(t('detail.deliverectOrderId'), code(order.deliverectOrderId), 'deliverectOrderId')}
      {field(t('detail.platform'), code(order.platformKey), 'platform')}
      {field(t('detail.channelOrderId'), code(order.channelOrderId), 'channelOrderId')}
      {field(t('detail.displayId'), code(order.channelDisplayId), 'displayId')}
      {field(t('detail.store'), code(order.storeCode), 'store')}
      {field(t('detail.account'), code(order.accountKey), 'account')}
      {field(t('detail.receivedAt'), <Ltr>{formatDateTime(order.receivedAt)}</Ltr>, 'receivedAt')}
      {field(
        t('detail.outcome'),
        <OutcomeBadge t={t} outcome={order.outcome} />,
        'outcome',
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
      <div className="col-span-full flex flex-col gap-0.5" data-order-field="document">
        <dt className="text-xs text-muted-foreground">{t('detail.document')}</dt>
        <dd className="text-sm">
          {order.documentNumber ? (
            <Link
              to={documentPath(order.documentNumber)}
              className="text-primary underline-offset-2 hover:underline"
              data-order-document-link={order.documentNumber}
            >
              <Trans
                t={t}
                i18nKey="detail.openDocument"
                values={{ document: order.documentNumber }}
                components={{ doc: <Ltr /> }}
              />
            </Link>
          ) : (
            <span className="text-muted-foreground" data-order-no-document="">
              {t('detail.noDocument')}
            </span>
          )}
        </dd>
      </div>
    </dl>
  )
}

/** The lines, a dropped one marked with its reason. Money in the order's currency. */
function Lines({ order }: { order: DeliverectOrderDetail }) {
  const { t } = useTranslation('deliverect-orders')
  const lines = order.lines ?? []
  return (
    <section className="flex flex-col gap-2" data-order-lines="">
      <h3 className="text-xs font-semibold tracking-tight">{t('detail.lines')}</h3>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('detail.noLines')}</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="border-b border-border/60 text-muted-foreground">
            <tr>
              <th className={TH}>{t('detail.lineColumns.plu')}</th>
              <th className={TH}>{t('detail.lineColumns.name')}</th>
              <th className={TH + ' text-end'}>{t('detail.lineColumns.quantity')}</th>
              <th className={TH + ' text-end'}>{t('detail.lineColumns.unitPrice')}</th>
              <th className={TH + ' text-end'}>{t('detail.lineColumns.fundedDiscount')}</th>
              <th className={TH}>{t('detail.lineColumns.material')}</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <LineRow key={i} line={line} currencyKey={order.currencyKey} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function LineRow({ line, currencyKey }: { line: DeliverectOrderLine; currencyKey: string }) {
  const { t } = useTranslation('deliverect-orders')
  return (
    <tr
      className={'border-b border-border/40 ' + (line.dropped ? 'bg-attention-050' : '')}
      data-order-line={line.plu}
      data-order-line-dropped={line.dropped ? '' : undefined}
    >
      <td className={TD + ' font-mono'}>
        <Ltr>{line.plu}</Ltr>
      </td>
      <td className="px-2 py-1.5 align-top">
        <bdi>{line.name}</bdi>
      </td>
      <td className={TD + ' text-end tabular-nums'}>
        <Ltr>{figure(line.quantity)}</Ltr>
      </td>
      <td className={TD + ' text-end tabular-nums'}>
        <Ltr>{money(line.unitPrice, currencyKey)}</Ltr>
      </td>
      <td className={TD + ' text-end tabular-nums'}>
        <Ltr>{money(line.fundedDiscount, currencyKey)}</Ltr>
      </td>
      <td className={TD + ' font-mono'}>{line.materialNumber ? <Ltr>{line.materialNumber}</Ltr> : null}</td>
      <td className="px-2 py-1.5 align-top" data-order-line-drop="">
        {line.dropped && (
          <span className="flex flex-col items-start gap-0.5">
            <StatusBadge sev="warn">{t('detail.dropped')}</StatusBadge>
            {line.droppedReason && (
              <span className="text-attention-800" data-order-line-drop-reason="">
                <bdi>{line.droppedReason}</bdi>
              </span>
            )}
          </span>
        )}
      </td>
    </tr>
  )
}

/** Every status sent, in words — the code's meaning, whether the call was OK, Deliverect's answer, the attempts. */
function Statuses({ statuses }: { statuses: DeliverectOrderStatusSent[] }) {
  const { t } = useTranslation('deliverect-orders')
  return (
    <section className="flex flex-col gap-2" data-order-statuses="">
      <h3 className="text-xs font-semibold tracking-tight">{t('detail.statuses')}</h3>
      {statuses.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-order-statuses-empty="">
          {t('detail.noStatuses')}
        </p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="border-b border-border/60 text-muted-foreground">
            <tr>
              <th className={TH}>{t('detail.statusColumns.status')}</th>
              <th className={TH}>{t('detail.statusColumns.sentAt')}</th>
              <th className={TH}>{t('detail.statusColumns.ok')}</th>
              <th className={TH}>{t('detail.statusColumns.answer')}</th>
              <th className={TH + ' text-end'}>{t('detail.statusColumns.attempts')}</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((s, i) => {
              const label = statusLabel(s.status)
              const alert = needsPerson(s.status)
              return (
                <tr
                  key={i}
                  className={'border-b border-border/40 ' + (alert ? 'bg-danger-050' : '')}
                  data-order-status-row={s.status}
                  data-order-status-alert={alert ? '' : undefined}
                >
                  <td className={TD}>
                    <span className="flex items-center gap-1.5">
                      <StatusBadge sev={label.sev}>
                        <Ltr>{statusText(t, s.status)}</Ltr>
                      </StatusBadge>
                      {alert && <NeedsPerson t={t} />}
                    </span>
                  </td>
                  <td className={TD}>
                    <Ltr>{formatDateTime(s.sentAt)}</Ltr>
                  </td>
                  <td className={TD} data-order-status-call={String(s.ok)}>
                    <StatusBadge sev={s.ok ? 'ok' : 'bad'}>{t(s.ok ? 'statusCall.ok' : 'statusCall.failed')}</StatusBadge>
                  </td>
                  <td className="px-2 py-1.5 align-top" data-order-status-answer="">
                    {s.answer ? <bdi>{s.answer}</bdi> : null}
                  </td>
                  <td className={TD + ' text-end tabular-nums'} data-order-status-attempts="">
                    <Ltr>{figure(s.attempts)}</Ltr>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
