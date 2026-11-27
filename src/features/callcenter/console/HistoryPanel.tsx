/**
 * The caller's history in the caller column (ticket 990, spec 983 D11, contract v1.13 C2):
 * **Last orders** with *Reorder all*, and **Usually buys** as one-click chips. It sits in
 * `CallerColumn`'s `history` slot, between the caller and the address book.
 *
 * - The read is the PAGE's (`historyRead` + `customerHistoryKey`): once per attached
 *   customer, never before an attach. This component only draws what it is handed.
 * - 🚩 **`null` is *could not load*, `[]` is *no history*** — the server's degraded read
 *   answers null lists (BackOffice 4455), and drawing them as empty would tell the agent
 *   the caller has never ordered.
 * - *Reorder all* and a chip both go through the page's ordinary add path. A chip is ONE
 *   add of quantity 1, exactly the search row's; *Reorder all* is `reorderAll`'s loop.
 * - Every figure here is the server's: the order's payable is drawn as given, never summed.
 */
import { useTranslation } from 'react-i18next'
import { Loader2, RotateCcw } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { CustomerHistory, CustomerHistoryOrder, CustomerUsualItem } from '@/core/models/callcenter'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatShortDate } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import { NOTE } from './console-notes'
import Money from './Money'
import { reorderLines, type ReorderLine, type ReorderReport } from './reorder'

/** How many of an order's items the card names before *+N more*. */
const ITEMS_SHOWN = 3

/** The channel words the console knows; any other value is drawn as the server sent it. */
const CHANNEL_KEYS: Record<string, string> = {
  callcenter: 'history.channel.callCenter',
  online: 'history.channel.online',
  store: 'history.channel.store',
}

/** A count for a plural sentence: `count` picks the form, `n` is the isolated figure. */
const counted = (count: number) => ({ count, n: fsi(formatNumber(count)) })

export interface HistoryRead {
  status: 'pending' | 'error' | 'success'
  data: CustomerHistory | undefined
  error: unknown
  fetching: boolean
  retry: () => void
}

export interface HistoryActions {
  read: HistoryRead
  /** Reorders these lines of that order. Absent ⇒ the door will not accept an add. */
  onReorder: ((orderNumber: string, lines: ReorderLine[]) => void) | null
  /** The order whose reorder is running, if any. */
  reordering: string | null
  /** The last reorder's report, held by the order it was for. */
  report: { orderNumber: string; report: ReorderReport } | null
  dismissReport: () => void
  /** One add of a usual item. Absent ⇒ the door will not accept an add. */
  onAddUsual: ((item: CustomerUsualItem) => void) | null
  /** The usual item being added, if any. */
  addingUsual: string | null
}

export default function HistoryPanel({ actions }: { actions: HistoryActions }) {
  const { t } = useTranslation('callcenter')
  const { read } = actions

  return (
    <section className="flex flex-col gap-3 border-b border-divider px-4 py-3" data-cc-history>
      <div className="flex flex-col gap-2" data-cc-last-orders>
        <h2 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('history.lastOrders')}
        </h2>
        <ReadState read={read} list={read.data?.orders} empty={t('history.noOrders')} marker="orders" />
        {read.data?.orders?.map((order) => (
          <OrderCard key={order.orderNumber} order={order} actions={actions} />
        ))}
      </div>

      <div className="flex flex-col gap-2" data-cc-usual>
        <h2 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('history.usuallyBuys')}
        </h2>
        <ReadState read={read} list={read.data?.usual} empty={t('history.noUsual')} marker="usual" />
        {read.data?.usual && read.data.usual.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {read.data.usual.map((item) => (
              <Button
                key={item.itemNumber}
                variant="secondary"
                onClick={() => actions.onAddUsual?.(item)}
                disabled={!actions.onAddUsual || actions.addingUsual !== null || actions.reordering !== null}
                title={t('history.addUsual')}
                data-cc-usual-chip={item.itemNumber}
                className="max-w-full"
              >
                {actions.addingUsual === item.itemNumber && (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                )}
                <bdi className="truncate">{item.description}</bdi>
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** Loading, failed, could-not-load (null) and empty — the four ways a list is not drawn. */
function ReadState({
  read,
  list,
  empty,
  marker,
}: {
  read: HistoryRead
  list: unknown[] | null | undefined
  empty: string
  marker: string
}) {
  const { t } = useTranslation('callcenter')
  if (read.status === 'pending')
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground" data-cc-history-loading={marker}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {t('history.loading')}
      </p>
    )
  const failed = read.status === 'error' || list === null
  if (failed)
    return (
      <div className="flex flex-col gap-1.5">
        <p className={NOTE.danger} data-cc-history-error={marker}>
          {read.status === 'error' ? apiErrorMessage(read.error, t('history.loadFailed')) : t('history.loadFailed')}
        </p>
        {/* Only the orders' block offers the retry: one read answers both lists. */}
        {marker === 'orders' && (
          <Button
            variant="outlined"
            onClick={read.retry}
            disabled={read.fetching}
            className="self-start"
            data-cc-history-retry
          >
            {t('actions.retry')}
          </Button>
        )}
      </div>
    )
  if (list && list.length === 0)
    return (
      <p className="text-xs text-muted-foreground" data-cc-history-empty={marker}>
        {empty}
      </p>
    )
  return null
}

function OrderCard({ order, actions }: { order: CustomerHistoryOrder; actions: HistoryActions }) {
  const { t } = useTranslation('callcenter')
  const running = actions.reordering === order.orderNumber
  const report = actions.report?.orderNumber === order.orderNumber ? actions.report.report : null
  const channelKey = CHANNEL_KEYS[order.channel.replace(/[\s_-]/g, '').toLowerCase()]
  const lines = reorderLines(order)
  const hidden = order.items.length - ITEMS_SHOWN

  return (
    <article
      className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2.5"
      data-cc-history-order={order.orderNumber}
    >
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <Ltr>
          <span className="font-mono text-[11px] text-muted-foreground" data-cc-history-order-id>
            {formatPair(order.orderNumber, formatShortDate(order.date))}
          </span>
        </Ltr>
        <Ltr>
          <Money value={order.payable} />
        </Ltr>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <span data-cc-history-channel>{channelKey ? t(channelKey) : <bdi>{order.channel}</bdi>}</span>
        {order.status && (
          <bdi data-cc-history-status>{order.status}</bdi>
        )}
      </div>
      <ul className="flex flex-col text-xs" data-cc-history-items>
        {order.items.slice(0, ITEMS_SHOWN).map((item) => (
          <li key={item.itemNumber} className="flex min-w-0 gap-1.5">
            <Ltr>
              <span className="text-muted-foreground" data-numeric>
                {item.qty}
              </span>
            </Ltr>
            <bdi className="truncate">{item.description}</bdi>
          </li>
        ))}
        {hidden > 0 && (
          <li className="text-muted-foreground" data-cc-history-more>
            {t('history.moreItems', counted(hidden))}
          </li>
        )}
      </ul>
      <Button
        variant="outlined"
        onClick={() => actions.onReorder?.(order.orderNumber, lines)}
        disabled={!actions.onReorder || actions.reordering !== null || lines.length === 0}
        className="self-start"
        data-cc-reorder={order.orderNumber}
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        )}
        {running ? t('history.reorder.running') : t('history.reorder.all')}
      </Button>
      {report && <ReorderReportView orderNumber={order.orderNumber} report={report} actions={actions} />}
    </article>
  )
}

/** What one *Reorder all* did NOT add, line by line, each with its own reason. */
function ReorderReportView({
  orderNumber,
  report,
  actions,
}: {
  orderNumber: string
  report: ReorderReport
  actions: HistoryActions
}) {
  const { t } = useTranslation('callcenter')
  if (report.refused.length === 0 && report.stopped === null) return null
  return (
    <div className={`${NOTE.attention} flex flex-col gap-1.5`} data-cc-reorder-report={orderNumber}>
      {report.refused.map(({ line, reason, message }) => (
        <p key={line.itemNumber} className="flex flex-col" data-cc-reorder-refused={line.itemNumber}>
          <bdi className="font-medium">{line.description}</bdi>
          {/* The server's own sentence for a refusal; the console's for an ask it will
              not accept on the agent's behalf. */}
          <span data-cc-server-text={reason === 'refused' ? '' : undefined}>
            {reason === 'refused' ? <bdi>{message}</bdi> : t('history.reorder.belowAtp')}
          </span>
        </p>
      ))}
      {report.stopped && (
        <>
          <p data-cc-reorder-stopped={report.stopped}>
            {t(report.stopped === 'busy' ? 'history.reorder.stoppedBusy' : 'history.reorder.stoppedClosed', {
              ...counted(report.notTried.length),
            })}
          </p>
          {report.stopped === 'busy' && actions.onReorder && (
            <Button
              variant="outlined"
              onClick={() => actions.onReorder?.(orderNumber, report.notTried)}
              disabled={actions.reordering !== null}
              className="self-start"
              data-cc-reorder-rest={orderNumber}
            >
              {t('history.reorder.rest', counted(report.notTried.length))}
            </Button>
          )}
        </>
      )}
      <Button variant="text" onClick={actions.dismissReport} className="self-end" data-cc-reorder-dismiss>
        {t('history.reorder.dismiss')}
      </Button>
    </div>
  )
}
