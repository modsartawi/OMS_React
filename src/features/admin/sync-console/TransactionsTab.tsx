import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import {
  COUNTER_FLAGS,
  TX_KIND_FILTERS,
  TX_STATUS_FILTERS,
  type CounterFlag,
  type StoreDetail,
  type StoreTransaction,
  type StoreTransactionsSummary,
  type TxKindFilter,
  type TxStatusFilter,
} from '@/core/models/sync-console'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney3 } from '@/core/util/number-format'
import { storeTransactionsQuery, syncConsoleAccessQuery } from './api'
import { figure } from './helpers'
import { isWpfStore } from './store-helpers'
import {
  DEFAULT_TRANSACTIONS_FILTER,
  TRANSACTIONS_PAGE_SIZE,
  localToday,
  pollsToday,
  transactionDays,
  type TransactionsFilter,
} from './transactions-helpers'
import { buildTransactionColumns } from './transactions-columns'
import Loading from './Loading'
import SnapshotDrawer from './SnapshotDrawer'
import TabGrid from './TabGrid'

/** A receipt's row id: the door's transaction id, unique within the store. */
const transactionId = (r: StoreTransaction) => r.transactionId

const SELECT =
  'h-7 rounded-md border border-border/60 bg-background px-2 text-xs text-foreground outline-none focus:border-primary/60'

/**
 * The Transactions tab (spec 444 amended by BackOffice spec 2586, ticket 467), from
 * `Store/Transactions`: one day's NewPos receipts as HQ's mirror holds them, each with
 * its live counter-rail flag, under the door's summary of the whole day.
 *
 * The day picker offers today (the default) and the window before it
 * (`transactionDays`), so the door's `BAD_DATE` cannot be reached. The status, kind and
 * counter filters ask the door from page 1; the receipt search is an exact match, asked
 * on submit, not per keystroke. The list is paged by the door at 50.
 *
 * Today re-reads every 60 s (`storeTransactionsQuery`); a past day never does, and a
 * closed tab is not mounted, so it never reads. The tab strip's Refresh re-reads it.
 *
 * Offered to every store (decision 5). A WPF store has no NewPos receipt: it says so
 * and asks nothing. A sink the door cannot read (`available: false`) says so, with no list.
 *
 * With `canOperate` (ticket 468) each row offers **View JSON**, which opens the receipt's
 * snapshot in a side sheet (`SnapshotDrawer`) — each opening one audited read. Without the
 * grant the action is absent.
 *
 * 🚩 The list never carries lines, tenders or customer data; only the drawer does, and
 * keeps nothing once closed.
 */
export default function TransactionsTab({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  if (isWpfStore(row))
    return (
      <p className="py-6 text-center text-sm text-muted-foreground" data-transactions-tab="wpf">
        {t('transactionsTab.wpf')}
      </p>
    )
  // Keyed by the store: another store's page starts on its own today, filters and closed drawer.
  return <TransactionsList key={row.code} code={row.code} />
}

function TransactionsList({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  // Read on every render, so a tab left open past midnight offers the new calendar's days;
  // the picked day stays what was picked (it is always sent), never moved under the reader.
  const now = new Date()
  const today = localToday(now)
  const days = transactionDays(now)
  const [day, setDay] = useState(today)
  const [filter, setFilter] = useState<TransactionsFilter>(DEFAULT_TRANSACTIONS_FILTER)
  // What the receipt box holds; `filter.receipt` is what was asked.
  const [draft, setDraft] = useState('')
  const [page, setPage] = useState(1)

  const access = useQuery(syncConsoleAccessQuery())
  const canOperate = access.data?.canOperate === true
  // The open drawer's receipt and which opening it is: each opening is its own audited read.
  const [viewing, setViewing] = useState<{ row: StoreTransaction; opening: number } | null>(null)
  const openings = useRef(0)
  // A grant withdrawn while the drawer is open closes it for good: it must not reopen, and re-read, on its own.
  useEffect(() => {
    if (!canOperate) setViewing(null)
  }, [canOperate])

  const read = useQuery({ ...storeTransactionsQuery(code, day, filter, page), placeholderData: keepPreviousData })
  const columns = useMemo(
    () => buildTransactionColumns(t, canOperate ? (row) => setViewing({ row, opening: ++openings.current }) : undefined),
    [t, canOperate],
  )
  // As on Mirror: a failed read draws none of the previous day's rows.
  const shown = read.isError ? undefined : read.data
  const total = shown?.items.total ?? 0

  // A picked day the window has moved past (the tab left open over days) is no longer
  // offered and the door would refuse it: back to today.
  const offered = days.includes(day)
  useEffect(() => {
    if (!offered) {
      setDay(today)
      setPage(1)
    }
  }, [offered, today])

  // As on Passes: an emptied inner page (a filter narrowed meanwhile) falls back to the new last page.
  const settled = shown && !read.isPlaceholderData ? shown.items : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: TRANSACTIONS_PAGE_SIZE,
    })
    if (last !== settled.page) setPage((p) => (p === settled.page ? last : p))
  }, [settled])

  // A day or any filter change goes back to page 1.
  const change = (next: Partial<TransactionsFilter>) => {
    setFilter((f) => ({ ...f, ...next }))
    setPage(1)
  }
  const pick = (next: string) => {
    setDay(next)
    setPage(1)
  }
  const search = () => {
    const receipt = draft.trim()
    setDraft(receipt)
    if (receipt !== filter.receipt) change({ receipt })
  }
  const clearSearch = () => {
    setDraft('')
    if (filter.receipt !== '') change({ receipt: '' })
  }

  return (
    <div className="flex flex-col gap-4" data-transactions-tab="list">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('transactionsTab.day.label')}
          <select value={day} onChange={(e) => pick(e.target.value)} className={SELECT} data-transactions-day="">
            {days.map((d, i) => (
              <option key={d} value={d}>
                {/* A native option is a string-only sink: the day isolated once. */}
                {i === 0 ? t('transactionsTab.day.today', { day: fsi(d) }) : fsi(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('transactionsTab.filters.status')}
          <select
            value={filter.status}
            onChange={(e) => change({ status: e.target.value as TxStatusFilter })}
            className={SELECT}
            data-transactions-status=""
          >
            {TX_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t(`transactionsTab.filters.statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('transactionsTab.filters.kind')}
          <select
            value={filter.kind}
            onChange={(e) => change({ kind: e.target.value as TxKindFilter })}
            className={SELECT}
            data-transactions-kind=""
          >
            {TX_KIND_FILTERS.map((k) => (
              <option key={k} value={k}>
                {t(`transactionsTab.filters.kinds.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('transactionsTab.filters.counter')}
          <select
            value={filter.counter ?? ''}
            onChange={(e) => change({ counter: (e.target.value || null) as CounterFlag | null })}
            className={SELECT}
            data-transactions-counter=""
          >
            <option value="">{t('transactionsTab.filters.allFlags')}</option>
            {COUNTER_FLAGS.map((f) => (
              <option key={f} value={f}>
                {t(`transactionsTab.counter.flags.${f}`)}
              </option>
            ))}
          </select>
        </label>
        <form
          className="flex items-center gap-1.5"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            search()
          }}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            dir="ltr"
            aria-label={t('transactionsTab.filters.receipt')}
            placeholder={t('transactionsTab.filters.receiptPlaceholder')}
            className={`${SELECT} w-48 font-mono`}
            data-transactions-receipt=""
          />
          <Button type="submit" variant="secondary" data-transactions-search="">
            {t('transactionsTab.filters.search')}
          </Button>
          {(draft !== '' || filter.receipt !== '') && (
            <Button variant="text" onClick={clearSearch} data-transactions-clear="">
              {t('transactionsTab.filters.clear')}
            </Button>
          )}
        </form>
        {pollsToday(day, today) && (
          <span className="text-xs text-muted-foreground" data-transactions-polling="">
            {t('transactionsTab.day.polling')}
          </span>
        )}
        {/* The previous rows stay drawn while the new ones load: say so. */}
        {read.isPlaceholderData && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status" data-transactions-loading="">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('transactionsTab.loading')}
          </span>
        )}
      </div>

      {read.isPending ? (
        <Loading label={t('transactionsTab.loading')} />
      ) : read.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(read.error, t('transactionsTab.failed'))} />
      ) : shown && !shown.available ? (
        <p className="py-6 text-center text-sm text-muted-foreground" data-transactions-unavailable="">
          {t('transactionsTab.unavailable')}
        </p>
      ) : (
        shown && (
          <>
            <Summary day={shown.day} summary={shown.summary} />
            <TabGrid
              rows={shown.items.items}
              columns={columns}
              rowId={transactionId}
              // Drawn only on an answer: the read's loading and failure are the tab's, above.
              pending={false}
              error={null}
              failed={t('transactionsTab.failed')}
              empty={t(page > 1 ? 'transactionsTab.emptyPage' : 'transactionsTab.empty')}
              loading={t('transactionsTab.loading')}
              data="transactions"
            />
          </>
        )
      )}
      {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
      {/* …but never under `available: false`, which draws no list. */}
      {shown?.available !== false && ((shown && showsPager(total, TRANSACTIONS_PAGE_SIZE)) || page > 1) && (
        <div className="overflow-hidden rounded-md border border-border/60">
          <GridPager page={page} pageSize={TRANSACTIONS_PAGE_SIZE} totalMatches={total} busy={read.isPlaceholderData} onPage={setPage} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('transactionsTab.note')}</p>
      {viewing && canOperate && (
        <SnapshotDrawer
          key={viewing.opening}
          code={code}
          row={viewing.row}
          opening={viewing.opening}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

/**
 * The door's summary of the day it served — never summed from the page's rows. The total
 * is signed by the door; mismatches show only when there are some, in the danger token.
 */
function Summary({ day, summary }: { day: string; summary: StoreTransactionsSummary }) {
  const { t } = useTranslation('sync-console')
  return (
    <section className="flex flex-col gap-2" aria-label={t('transactionsTab.summary.label')} data-transactions-summary={day}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Trans t={t} i18nKey="transactionsTab.summary.title" values={{ day }} components={{ d: <Ltr /> }} />
      </h3>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <SummaryFact label={t('transactionsTab.summary.sales')} data="sales">
          <Ltr>{figure(summary.sales)}</Ltr>
        </SummaryFact>
        <SummaryFact label={t('transactionsTab.summary.returns')} data="returns">
          <Ltr>{figure(summary.returns)}</Ltr>
        </SummaryFact>
        <SummaryFact label={t('transactionsTab.summary.total')} data="total">
          <Ltr>{formatMoney3(summary.total)}</Ltr>
        </SummaryFact>
        <SummaryFact label={t('transactionsTab.summary.lastCompletedAt')} data="lastCompletedAt">
          {summary.lastCompletedAt ? (
            <Ltr>{formatDateTime(summary.lastCompletedAt)}</Ltr>
          ) : (
            <span className="text-muted-foreground">{t('transactionsTab.summary.noneYet')}</span>
          )}
        </SummaryFact>
        <SummaryFact label={t('transactionsTab.summary.notYet')} data="notYet">
          <Ltr>{figure(summary.notYet)}</Ltr>
        </SummaryFact>
        {summary.mismatches > 0 && (
          <SummaryFact label={t('transactionsTab.summary.mismatches')} data="mismatches">
            <span className="text-danger-800">
              <Ltr>{figure(summary.mismatches)}</Ltr>
            </span>
          </SummaryFact>
        )}
      </div>
    </section>
  )
}

/** One labelled figure of the summary, as the health summary draws its facts. */
function SummaryFact({ label, data, children }: { label: string; data: string; children: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-sm" data-summary-figure={data}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{children}</span>
    </p>
  )
}
