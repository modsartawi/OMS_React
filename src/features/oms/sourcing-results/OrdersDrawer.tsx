import { useId, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Loader2, PlayCircle } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type {
  ResultsCardShipment,
  ResultsClass,
  ResultsFigure,
  ResultsOrderCard,
  ResultsOrderRow,
  ResultsOrderSort,
  ResultsQuery,
} from '@/core/models/sourcing-results'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { fsi, formatPair, formatParts } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { simulatorRunPath } from '@/core/sourcing-advisor/simulator-path'
import { sourcingResultsApi } from './api'
import { encodeFigure } from './figure'
import { HATCH, classInk, modeInk } from './inks'
import { countText } from './text'

export const ORDERS_PAGE_SIZE = 25

const COLUMNS: ResultsOrderSort[] = ['orderNumber', 'landedAt', 'channel', 'wholePlan', 'storesOnly', 'estimateMinutes', 'ending']

/** The drawer's title: the figure in words. */
export function figureTitle(t: TFunction<'sourcing-results'>, f: ResultsFigure): string {
  switch (f.kind) {
    case 'segment':
      return t(`top.segments.${f.segment}`)
    case 'class':
      return t('drawer.figures.class', { view: t(`views.${f.view}`), cls: t(`classes.${f.cls}`) })
    case 'promise':
      return t('drawer.figures.promise', { row: f.channelGroup ? t(`promise.pickUpGroups.${f.channelGroup}`) : t(`modes.${f.mode}`) })
    case 'mark':
      return t('drawer.figures.mark', { mark: t(`marks.names.${f.mark}`) })
    case 'runNotEnded':
      return t('drawer.figures.runNotEnded')
    case 'notRun':
      return t('drawer.figures.notRun')
  }
}

/** Minutes against what happened, in words; + = the advisor's plan earlier. */
export function estimateWords(t: TFunction<'sourcing-results'>, minutes: number | null): string {
  if (minutes == null) return t('dash')
  if (minutes === 0) return t('drawer.estimate.same')
  return t(minutes > 0 ? 'drawer.estimate.earlier' : 'drawer.estimate.later', { minutes: fsi(Math.abs(minutes)) })
}

/**
 * The orders behind a figure (ticket 971, results ticket decision 5), from the side so the page keeps its width:
 * paged and sortable (export is not built, spec 4354 Further Notes), and a chosen order's card above the list — the
 * advisor's plan (Recommended) beside what happened (a dashed box), the estimate in one sentence, how it ended, and
 * "Open the stored run in the simulator".
 */
export default function OrdersDrawer({ figure, query, onClose }: { figure: ResultsFigure; query: ResultsQuery; onClose: () => void }) {
  const { t } = useTranslation('sourcing-results')
  const titleId = useId()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ by: ResultsOrderSort; descending: boolean }>({ by: 'landedAt', descending: true })
  const [chosen, setChosen] = useState<string | null>(null)
  const encoded = encodeFigure(figure)

  const orders = useQuery({
    queryKey: ['sourcing-results', 'orders', query, encoded, page, sort],
    queryFn: () =>
      sourcingResultsApi.orders({ ...query, figure: encoded, page, pageSize: ORDERS_PAGE_SIZE, sort: sort.by, descending: sort.descending }),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const total = orders.data?.total ?? 0

  const sortBy = (by: ResultsOrderSort) => {
    setSort((prev) => (prev.by === by ? { by, descending: !prev.descending } : { by, descending: false }))
    setPage(1)
  }

  return (
    <SideSheet onClose={onClose} width="w-[60rem]" aria-labelledby={titleId} data-results-drawer={encoded}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('drawer.eyebrow')}
        title={figureTitle(t, figure)}
        hint={orders.data ? t('drawer.count', { count: total, n: fsi(countText(total)) }) : undefined}
        closeLabel={t('drawer.close')}
        onClose={onClose}
        closeData={{ 'data-drawer-close': '' }}
      />
      <div className={SHEET_BODY}>
        {chosen ? <OrderCard orderNumber={chosen} /> : <p className="text-xs text-muted-foreground">{t('drawer.choose')}</p>}

        {orders.isError ? (
          <ErrorBanner title={t('drawer.failedTitle')} message={apiErrorMessage(orders.error, t('drawer.failed'))} />
        ) : orders.isPending ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('drawer.loading')}
          </p>
        ) : orders.data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-drawer-empty="">
            {t('drawer.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm" data-drawer-orders="">
              <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c} className={TH} aria-sort={sort.by === c ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 font-medium hover:text-foreground"
                        onClick={() => sortBy(c)}
                        data-sort={c}
                      >
                        {t(`drawer.cols.${c}`)}
                        {sort.by === c && (sort.descending ? <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUp className="h-3 w-3" aria-hidden />)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.data.rows.map((r) => (
                  <OrderRow key={r.orderNumber} row={r} chosen={r.orderNumber === chosen} onChoose={() => setChosen(r.orderNumber)} />
                ))}
              </tbody>
            </table>
            {showsPager(total, ORDERS_PAGE_SIZE) && (
              <GridPager page={page} pageSize={ORDERS_PAGE_SIZE} totalMatches={total} busy={orders.isFetching} onPage={setPage} />
            )}
          </div>
        )}
      </div>
    </SideSheet>
  )
}

function ClassPill({ cls }: { cls: ResultsClass }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: classInk(cls), backgroundImage: cls === 'CALLOUT_FALLBACK' ? HATCH : undefined }} aria-hidden />
      {t(`classes.${cls}`)}
    </span>
  )
}

const channelName = (t: TFunction<'sourcing-results'>, code: string) => t(`channels.${code}`, { defaultValue: code })

function OrderRow({ row, chosen, onChoose }: { row: ResultsOrderRow; chosen: boolean; onChoose: () => void }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <tr className={`border-b border-border/60 ${chosen ? 'bg-primary-050' : ''}`} data-order-row={row.orderNumber}>
      <td className={TD}>
        <button
          type="button"
          className="cursor-pointer font-mono font-semibold underline decoration-dotted underline-offset-2 hover:text-primary"
          aria-pressed={chosen}
          onClick={onChoose}
          data-order={row.orderNumber}
        >
          <Ltr>{row.orderNumber}</Ltr>
        </button>
      </td>
      <td className={TD}>
        <Ltr>{formatDateTime(row.landedAt)}</Ltr>
      </td>
      <td className={TD}>
        <bdi>{channelName(t, row.channel)}</bdi>
        <div className="text-xs text-muted-foreground">
          <bdi>{row.city}</bdi>
        </div>
      </td>
      <td className={TD}>
        <ClassPill cls={row.wholePlan} />
      </td>
      <td className={TD}>
        <ClassPill cls={row.storesOnly} />
      </td>
      <td className={TD}>{estimateWords(t, row.estimateMinutes)}</td>
      <td className={TD}>
        {t(`endings.${row.ending}`)}
        {row.stockShortLine && <div className="text-xs text-muted-foreground">{t('drawer.stockShortLine')}</div>}
      </td>
    </tr>
  )
}

function OrderCard({ orderNumber }: { orderNumber: string }) {
  const { t } = useTranslation('sourcing-results')
  const navigate = useNavigate()
  const card = useQuery({
    queryKey: ['sourcing-results', 'order', orderNumber],
    queryFn: () => sourcingResultsApi.order(orderNumber),
    retry: false,
  })
  if (card.isError) return <ErrorBanner title={t('card.failedTitle')} message={apiErrorMessage(card.error, t('card.failed'))} />
  if (card.isPending)
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('card.loading')}
      </p>
    )
  const c: ResultsOrderCard = card.data
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3" data-order-card={c.orderNumber}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <b className="text-sm">
          {t('card.order')}{' '}
          <span className="font-mono">
            <Ltr>{c.orderNumber}</Ltr>
          </span>
        </b>
        <span className="text-xs text-muted-foreground">
          {/* A line led by a machine value (the landed time): isolated once, whole (bidi rule). */}
          <Ltr>{formatParts([formatDateTime(c.landedAt), channelName(t, c.channel), c.city])}</Ltr>
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Side title={t('card.plan')} shipments={c.plan} data="plan" />
        <Side title={t('card.happened')} shipments={c.happened} data="happened" dashed />
      </div>
      <p className="text-sm" data-card-estimate="">
        {c.estimateMinutes == null ? t('card.noEstimate') : t('card.estimate', { words: estimateWords(t, c.estimateMinutes) })}
      </p>
      <p className="text-xs text-muted-foreground" data-card-ending="">
        {t('card.ended', { ending: t(`endings.${c.ending}`) })}
      </p>
      <div>
        <Button variant="primary" onClick={() => navigate(simulatorRunPath(c.runId))} data-open-simulator={c.runId}>
          <PlayCircle className="h-4 w-4" aria-hidden />
          {t('card.openSimulator')}
        </Button>
      </div>
    </section>
  )
}

function Side({ title, shipments, data, dashed = false }: { title: string; shipments: ResultsCardShipment[]; data: string; dashed?: boolean }) {
  const { t, i18n } = useTranslation('sourcing-results')
  return (
    <div className={`flex flex-col gap-2 rounded-md border p-2.5 ${dashed ? 'border-dashed border-muted-foreground' : 'border-border'}`} data-card-side={data}>
      <h3 className="text-xs font-semibold">{title}</h3>
      {shipments.map((s, i) => (
        <div key={i} className="text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: modeInk(s.mode) }} aria-hidden />
            {t(`modes.${s.mode}`)}
          </span>{' '}
          <span className="text-muted-foreground">{t('card.from')}</span>{' '}
          <Ltr>{formatPair(s.store, s.storeName)}</Ltr>
          {s.km != null ? (
            <span className="text-muted-foreground">
              {' '}
              (<Ltr>{t('card.km', { km: s.km.toFixed(1) })}</Ltr>)
            </span>
          ) : (
            <span className="text-muted-foreground"> ({t('card.noLocation')})</span>
          )}
          <div className="text-xs text-muted-foreground">
            {t('card.lines', { count: s.lines, n: fsi(s.lines) })} · <bdi>{(i18n.language === 'ar' && s.when.ar) || s.when.en}</bdi>
          </div>
        </div>
      ))}
    </div>
  )
}
