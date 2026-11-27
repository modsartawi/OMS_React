import { useId, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Loader2, PlayCircle } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type {
  ResultsCardShipment,
  ResultsFigure,
  ResultsOrderCard,
  ResultsOrderRow,
  ResultsOrderSort,
  ResultsQuery,
  ResultsSourcedMoney,
} from '@/core/models/sourcing-results'
import { usePermissions } from '@/core/permissions'
import { canOpenStoredRun } from '@/core/sourcing-advisor/access'
import { simulatorRunPath } from '@/core/sourcing-advisor/simulator-path'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { fsi, formatParts, formatRange } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'
import { sourcingResultsApi } from './api'
import { useWordString, Word } from './codes'
import { estimateWords } from './estimate-words'
import { figureKey, ordersRequest } from './figure'
import { classInk, modeInk } from './inks'
import { countText } from './text'

export const ORDERS_PAGE_SIZE = 25

/** The list's columns; a column with a sort is one the door sorts by (BO 4393 `ResultSorts`). */
const COLUMNS: { col: string; sort: ResultsOrderSort | null }[] = [
  { col: 'order', sort: 'ORDER' },
  { col: 'landed', sort: 'LANDED' },
  { col: 'channel', sort: 'CHANNEL' },
  { col: 'city', sort: 'CITY' },
  { col: 'wholeClass', sort: null },
  { col: 'storesClass', sort: null },
  { col: 'estimate', sort: 'ESTIMATE' },
  { col: 'ending', sort: 'ENDING' },
]

/** The drawer's title: the figure in words (a string sink: data values take `fsi`). */
export function useFigureTitle(): (f: ResultsFigure) => string {
  const { t } = useTranslation('sourcing-results')
  const word = useWordString()
  return (f) => {
    switch (f.kind) {
      case 'segment':
        return t(`top.segments.${f.segment}`)
      case 'class':
        return f.ending
          ? t('drawer.figures.classEnding', { view: t(`views.${f.view}`), cls: t(`classes.${f.cls}`), ending: t(`endings.${f.ending}`) })
          : t('drawer.figures.class', { view: t(`views.${f.view}`), cls: t(`classes.${f.cls}`) })
      case 'outside':
        return t('outsideRules.figure', { reason: outsideWords(word, f.code, f.step) })
      case 'breakdown':
        return t('breakdowns.figure', { by: t(`breakdowns.by.${f.by}`), row: breakdownKeyWords(t, word, f.by, f.key) })
      case 'laterSlot':
        return t('laterSlots.figureHour', { hour: fsi(`${String(f.hour).padStart(2, '0')}:00`) })
      case 'mark':
        return t('drawer.figures.mark', { mark: word('COMPARISON_MARK', f.mark, `marks.names.${f.mark}`) })
    }
  }
}

/** An outside reason in words: the refused pin's code, and the step that removed the pair when there is one. */
export function outsideWords(word: ReturnType<typeof useWordString>, code: string, step: string): string {
  const pin = word('PIN', code)
  return step ? `${pin}: ${word('FILTER', step, `outsideRules.steps.${step}`)}` : pin
}

/** A breakdown row's key in words, for a string sink. */
export function breakdownKeyWords(t: TFunction<'sourcing-results'>, word: ReturnType<typeof useWordString>, by: string, key: string): string {
  switch (by) {
    case 'MODE':
    case 'SHORT_FIGURE':
      return word('MODE_MIX', key, `breakdowns.modeRows.${key}`)
    case 'CHANNEL':
      return word('CHANNEL', key, `channels.${key}`)
    case 'MADE_BY':
      return key === 'CHANNEL' || key === 'OMS' ? t(`breakdowns.madeBy.${key}`) : word('OWN_RUN', key)
    case 'OWN_SPLIT':
      return word('OWN_SPLIT', key, `breakdowns.splitParts.${key}`)
    default:
      return fsi(key)
  }
}

/**
 * The orders behind a figure (ticket 971, results ticket decision 5; BO 4393 `Results/Orders`), from the side so the
 * page keeps its width: paged and sortable (export is not built, spec 4354 Further Notes), and a chosen order's card
 * above the list — the advisor's plan beside what happened, the estimate, how it ended, its riyal figures each with
 * its source, and "Open the stored run in the simulator".
 */
export default function OrdersDrawer({ figure, query, onClose }: { figure: ResultsFigure; query: ResultsQuery; onClose: () => void }) {
  const { t } = useTranslation('sourcing-results')
  const title = useFigureTitle()
  const titleId = useId()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ by: ResultsOrderSort; desc: boolean }>({ by: 'LANDED', desc: true })
  const [chosen, setChosen] = useState<string | null>(null)
  const key = figureKey(figure)

  const orders = useQuery({
    queryKey: ['sourcing-results', 'orders', query, key, page, sort],
    queryFn: () => sourcingResultsApi.orders(ordersRequest(query, figure, { page, pageSize: ORDERS_PAGE_SIZE, sort: sort.by, desc: sort.desc })),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const total = orders.data?.total ?? 0

  const sortBy = (by: ResultsOrderSort) => {
    setSort((prev) => (prev.by === by ? { by, desc: !prev.desc } : { by, desc: false }))
    setPage(1)
  }

  return (
    <SideSheet onClose={onClose} width="w-[64rem]" aria-labelledby={titleId} data-results-drawer={key}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('drawer.eyebrow')}
        title={title(figure)}
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
                  {COLUMNS.map(({ col, sort: by }) => (
                    <th key={col} className={TH} aria-sort={by && sort.by === by ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                      {by ? (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 font-medium hover:text-foreground"
                          onClick={() => sortBy(by)}
                          data-sort={by}
                        >
                          {t(`drawer.cols.${col}`)}
                          {sort.by === by && (sort.desc ? <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUp className="h-3 w-3" aria-hidden />)}
                        </button>
                      ) : (
                        t(`drawer.cols.${col}`)
                      )}
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

function ClassPill({ cls }: { cls: string }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: classInk(cls) }} aria-hidden />
      {t(`classes.${cls}`, { defaultValue: fsi(cls) })}
    </span>
  )
}

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
        <Word k={`channels.${row.channel}`} family="CHANNEL" code={row.channel} />
      </td>
      <td className={TD}>
        <bdi>{row.city}</bdi>
      </td>
      <td className={TD}>
        <ClassPill cls={row.wholeClass} />
      </td>
      <td className={TD}>
        <ClassPill cls={row.storesClass} />
      </td>
      <td className={TD}>
        <div>{estimateWords(t, row.wholeEstimate)}</div>
        <div className="text-xs text-muted-foreground">{t('drawer.storesEstimate', { words: estimateWords(t, row.storesEstimate) })}</div>
      </td>
      <td className={TD}>
        {t(`endings.${row.ending}`)}
        {row.shortFigure && <div className="text-xs text-muted-foreground">{t('drawer.shortFigure')}</div>}
      </td>
    </tr>
  )
}

function OrderCard({ orderNumber }: { orderNumber: string }) {
  const { t } = useTranslation('sourcing-results')
  const navigate = useNavigate()
  const opensRun = canOpenStoredRun(usePermissions())
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
          <Ltr>{formatParts([formatDateTime(c.landedAt), c.channel, c.city])}</Ltr>
        </span>
      </div>
      <p className="text-xs text-muted-foreground" data-card-run="">
        {t('card.ran', {
          set: t('filters.set', { name: fsi(c.weightSetName), version: fsi(c.weightSetVersion) }),
          at: fsi(formatDateTime(c.ranAt)),
        })}
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        <Side title={t('card.plan')} shipments={c.wholePlan} data="whole-plan" />
        <Side title={t('card.storesOnly')} shipments={c.storesOnly} data="stores-only" />
        <Side title={t('card.happened')} shipments={c.deliveries} data="happened" dashed />
      </div>
      <p className="text-sm" data-card-estimate="">
        {c.wholeEstimate == null ? t('card.noEstimate') : t('card.estimate', { words: estimateWords(t, c.wholeEstimate) })}
      </p>
      <p className="text-xs text-muted-foreground" data-card-ending="">
        {t('card.ended', { ending: t(`endings.${c.ending}`) })}
        {c.outsideCode && (
          <>
            {' · '}
            {t('card.outside')} <Word family="PIN" code={c.outsideCode} />
          </>
        )}
        {c.notComparableWhy && (
          <>
            {' · '}
            <Word family="NOT_COMPARABLE_WHY" code={c.notComparableWhy} />
          </>
        )}
      </p>
      <Money card={c} />
      {/* Review 4354 #4: hidden until the simulator reads the stored run, and then only under the run grant. */}
      {opensRun && c.runId && (
        <div>
          <Button variant="primary" onClick={() => navigate(simulatorRunPath(c.runId))} data-open-simulator={c.runId}>
            <PlayCircle className="h-4 w-4" aria-hidden />
            {t('card.openSimulator')}
          </Button>
        </div>
      )}
    </section>
  )
}

/** Riyals appear on one order only, each with its source (results ticket decision 4). */
function Money({ card }: { card: ResultsOrderCard }) {
  const { t } = useTranslation('sourcing-results')
  const rows: [string, ResultsSourcedMoney | null][] = [
    ['wholeListFee', card.wholeListFee],
    ['realListFee', card.realListFee],
    ['feePaid', card.feePaid],
    ['wholeCompanyCost', card.wholeCompanyCost],
    ['realCompanyCost', card.realCompanyCost],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5" data-card-money="">
      {rows.map(([k, m]) => (
        <div key={k} className="flex flex-col" data-card-money-row={k}>
          <dt className="text-muted-foreground">{t(`card.money.${k}`)}</dt>
          <dd>
            {m ? (
              <>
                <Ltr>{formatMoney(m.amount)}</Ltr> <span className="text-muted-foreground">(<Word family="MONEY_SOURCE" code={m.source} />)</span>
              </>
            ) : (
              <span className="text-muted-foreground">{t('card.money.unknown')}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Side({ title, shipments, data, dashed = false }: { title: string; shipments: ResultsCardShipment[]; data: string; dashed?: boolean }) {
  const { t } = useTranslation('sourcing-results')
  const when = (s: ResultsCardShipment): ReactNode =>
    s.handedOverAt ? (
      t('card.handedOver', { at: fsi(formatDateTime(s.handedOverAt)) })
    ) : s.slotFrom && s.slotTo ? (
      <Ltr>{formatRange(formatDateTime(s.slotFrom), formatDateTime(s.slotTo).slice(11))}</Ltr>
    ) : s.promisedBy ? (
      t('card.promisedBy', { at: fsi(formatDateTime(s.promisedBy)) })
    ) : null
  return (
    <div className={`flex flex-col gap-2 rounded-md border p-2.5 ${dashed ? 'border-dashed border-muted-foreground' : 'border-border'}`} data-card-side={data}>
      <h3 className="text-xs font-semibold">{title}</h3>
      {shipments.length === 0 && <p className="text-xs text-muted-foreground">{t('dash')}</p>}
      {shipments.map((s) => (
        <div key={`${s.no}:${s.deliveryNo}`} className="text-sm" data-card-shipment={s.no}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: modeInk(s.mode) }} aria-hidden />
            {t(`modes.${s.mode}`, { defaultValue: fsi(s.mode) })}
          </span>{' '}
          <span className="text-muted-foreground">{t('card.from')}</span> <Ltr>{s.store}</Ltr>
          {s.distanceBand && (
            <span className="text-muted-foreground">
              {' '}
              (<Word k={`checks.distance.bands.${s.distanceBand}`} family="DISTANCE_BAND" code={s.distanceBand} />)
            </span>
          )}
          <div className="text-xs text-muted-foreground">
            {t('card.lines', { count: s.lines.length, n: fsi(s.lines.length) })}
            {when(s) != null && <> · {when(s)}</>}
            {s.ending && (
              <>
                {' · '}
                <Word family="DELIVERY_ENDING" code={s.ending} />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

