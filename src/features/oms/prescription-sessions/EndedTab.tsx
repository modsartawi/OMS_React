import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { RotateCcw, Search } from 'lucide-react'
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import type { PrescriptionSessionHqEndedRow } from '@/core/models/prescription-session'
import { AfterCloseText, Word } from '@/core/prescription-session/SessionWords'
import { PRESCRIPTION_SESSION_NS, stateWord, wordText } from '@/core/prescription-session/words'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatDateTime } from '@/core/util/date-format'
import { prescriptionSessionsApi } from './api'
import Denied from './Denied'
import {
  ENDED_RANGE_DAYS,
  ENDED_ROW_CAP,
  ENDED_STATES,
  defaultEndedFilter,
  endedFilterFromParams,
  endedFilterToParams,
  endedRangeProblem,
  endedRequest,
  type EndedFilter,
  type EndedRangeProblem,
} from './ended-filter'
import { endedRow, type EndedRowView } from './ended-row'

/** The bad-filter refusal (`PrescriptionSessionHqErrorCodes.BadFilter`): said beside the filters. */
const BAD_FILTER = 'PSES-00223'

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'
const TH = 'px-3 py-2 text-start text-xs font-semibold whitespace-nowrap text-muted-foreground'
const TD = 'px-3 py-2 align-top'

/** The page reads the address with no `today` argument: the reader's own day. */
const fromParams = (params: URLSearchParams) => endedFilterFromParams(params)

/**
 * The Ended tab (ticket 547; BackOffice spec 2994 story 71): the sessions that ended in a date range
 * — closed, abandoned or written off — each with how it ended, its sales and, under it, the same
 * after-close lines Document Details draws (544's `AfterCloseText`). Read only.
 *
 * The search is a draft promoted by Search; its range is checked before it is sent (the server's own
 * 92-day / reversed / missing refusal, `PSES-00223`, stays the backstop and is said beside the
 * filters). A pasted address with a bad range is refused the same way and asks nothing.
 *
 * Not a grid: each session carries a variable number of after-close lines drawn UNDER its row, which
 * AG Grid Community has no detail row for. A plain table with one follow-up row per session does it.
 */
export default function EndedTab() {
  const { t } = useTranslation('prescription-sessions')
  const { t: tw } = useTranslation(PRESCRIPTION_SESSION_NS)
  const { query: filter, update, changedFromOutside } = useUrlQuery(fromParams, endedFilterToParams)
  const [draft, setDraft] = useState<EndedFilter>(filter)
  const [draftProblem, setDraftProblem] = useState<EndedRangeProblem | null>(null)

  useEffect(() => {
    if (changedFromOutside()) {
      setDraft(filter)
      setDraftProblem(null)
    }
  }, [filter, changedFromOutside])

  const problem = endedRangeProblem(filter)
  const request = endedRequest(filter)
  const list = useQuery({
    queryKey: ['prescription-sessions', 'ended', request],
    queryFn: () => prescriptionSessionsApi.ended(filter),
    enabled: problem === null,
    retry: false,
  })

  const rows = useMemo(
    () => (list.isError ? [] : (list.data ?? [])).map((r) => ({ row: r, view: endedRow(r) })),
    [list.data, list.isError],
  )

  if (isBareDenial(list.error)) return <Denied />

  const badFilter = list.isError && apiErrorCode(list.error) === BAD_FILTER
  const shownProblem = draftProblem ?? problem
  const patch = (p: Partial<EndedFilter>) => {
    setDraft((d) => ({ ...d, ...p }))
    setDraftProblem(null)
  }
  const search = () => {
    const p = endedRangeProblem(draft)
    setDraftProblem(p)
    if (p) return
    update(() => ({ ...draft, store: draft.store.trim() }))
    if (problem === null) void list.refetch()
  }
  const reset = () => {
    const fresh = defaultEndedFilter(new Date())
    setDraft(fresh)
    setDraftProblem(null)
    update(() => fresh)
  }

  return (
    <div className="flex flex-col gap-3" data-ps-ended="">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
        noValidate
        data-ps-ended-filters=""
      >
        <label className={FIELD}>
          {t('ended.filters.from')}
          <input
            type="date"
            value={draft.from}
            onChange={(e) => patch({ from: e.target.value })}
            className={`${INPUT} w-40`}
            data-ps-ended-filter="from"
          />
        </label>
        <label className={FIELD}>
          {t('ended.filters.to')}
          <input
            type="date"
            value={draft.to}
            onChange={(e) => patch({ to: e.target.value })}
            className={`${INPUT} w-40`}
            data-ps-ended-filter="to"
          />
        </label>
        <label className={FIELD}>
          {t('ended.filters.store')}
          <input
            type="text"
            value={draft.store}
            onChange={(e) => patch({ store: e.target.value })}
            placeholder={t('filters.storePlaceholder')}
            aria-describedby="ps-ended-store-hint"
            className={`${INPUT} w-28`}
            data-ps-ended-filter="store"
          />
          <span id="ps-ended-store-hint" className="font-normal">
            {t('ended.filters.storeHint')}
          </span>
        </label>
        <label className={FIELD}>
          {t('ended.filters.state')}
          <select
            value={draft.state}
            onChange={(e) => patch({ state: e.target.value })}
            className={`${INPUT} w-44`}
            data-ps-ended-filter="state"
          >
            <option value="">{t('ended.filters.anyEnd')}</option>
            {ENDED_STATES.map((c) => (
              <option key={c} value={c}>
                {wordText(tw, stateWord(c))}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 self-start pt-5">
          <Button type="submit" disabled={list.isFetching} data-ps-ended-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('filters.search')}
          </Button>
          <Button variant="outlined" onClick={reset} data-ps-ended-reset="">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('filters.reset')}
          </Button>
        </div>
        {shownProblem && (
          <p role="alert" className="basis-full text-xs text-danger-800" data-ps-ended-range={shownProblem}>
            <Trans t={t} i18nKey={`ended.range.${shownProblem}`} values={{ days: String(ENDED_RANGE_DAYS) }} components={{ n: <Ltr /> }} />
          </p>
        )}
        {!shownProblem && badFilter && (
          <p role="alert" className="basis-full text-xs text-danger-800" data-ps-bad-filter="">
            <bdi>{apiErrorMessage(list.error, t('filters.bad'))}</bdi>
          </p>
        )}
      </form>

      {list.isError && !badFilter && (
        <ErrorBanner className="p-2.5" title={t('ended.failedTitle')} message={apiErrorMessage(list.error, t('ended.failed'))} />
      )}

      {!problem && !list.isError && rows.length >= ENDED_ROW_CAP && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-sm text-attention-800" role="status" data-ps-ended-capped="">
          <Trans t={t} i18nKey="ended.capped" values={{ n: String(ENDED_ROW_CAP) }} components={{ n: <Ltr /> }} />
        </p>
      )}

      {!problem && !list.isError && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card" data-ps-ended-table="">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-border bg-card-2">
              <tr>
                <th className={TH}>{t('ended.columns.displayId')}</th>
                <th className={TH}>{t('ended.columns.source')}</th>
                <th className={TH}>{t('ended.columns.holdingStore')}</th>
                <th className={TH}>{t('ended.columns.state')}</th>
                <th className={TH}>{t('ended.columns.route')}</th>
                <th className={TH}>{t('ended.columns.createdAt')}</th>
                <th className={TH}>{t('ended.columns.dispensedAt')}</th>
                <th className={TH}>{t('ended.columns.endedAt')}</th>
                <th className={TH}>{t('ended.columns.endedBy')}</th>
                <th className={TH}>{t('ended.columns.endReason')}</th>
                <th className={TH}>{t('ended.columns.sales')}</th>
              </tr>
            </thead>
            <tbody>
              {list.isPending && (
                <tr>
                  <td colSpan={COLUMNS} className={`${TD} text-muted-foreground`}>
                    {t('statusBar.loading')}
                  </td>
                </tr>
              )}
              {!list.isPending && rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS} className={`${TD} text-muted-foreground`} data-ps-ended-empty="">
                    {t('ended.empty')}
                  </td>
                </tr>
              )}
              {rows.map(({ row, view }) => (
                <EndedSession key={row.sessionId} row={row} view={view} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!problem && !list.isError && (
        <div
          className="flex h-7 shrink-0 items-center gap-3 overflow-hidden rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
          data-status-bar=""
        >
          {list.isFetching ? (
            <span>{t('statusBar.loading')}</span>
          ) : (
            <span data-status-count="">
              <Trans t={t} i18nKey="statusBar.rows" count={rows.length} values={{ n: String(rows.length) }} components={{ n: <Ltr /> }} />
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const COLUMNS = 11

/** One ended session: its row, then — when it has any — its after-close lines under it. */
function EndedSession({ row, view }: { row: PrescriptionSessionHqEndedRow; view: EndedRowView }) {
  const { t } = useTranslation('prescription-sessions')
  const code = 'font-mono text-[12px]'
  const when = (v: string | null) => (v ? <Ltr>{formatDateTime(v) || v}</Ltr> : null)
  const hasAfter = view.afterClose.length > 0
  return (
    <>
      <tr className={hasAfter ? '' : 'border-b border-border/60'} data-ps-ended-row={row.sessionId} data-ps-ended-state={row.state}>
        <td className={`${TD} ${code}`}>
          <Ltr>{row.displayId}</Ltr>
        </td>
        <td className={TD}>
          <Word word={view.source} />
        </td>
        <td className={`${TD} ${code}`}>
          <Ltr>{row.holdingStore}</Ltr>
        </td>
        <td className={TD}>
          <StatusBadge sev={view.stateSev}>
            <Word word={view.state} />
          </StatusBadge>
        </td>
        <td className={TD}>
          <Word word={view.route} />
        </td>
        <td className={`${TD} tabular-nums whitespace-nowrap`}>{when(row.createdAt)}</td>
        <td className={`${TD} tabular-nums whitespace-nowrap`}>{when(row.dispensedAt)}</td>
        <td className={`${TD} tabular-nums whitespace-nowrap`} data-ps-ended-at="">
          {when(row.endedAt)}
        </td>
        <td className={TD} data-ps-ended-by="">
          {row.endedBy ? <bdi>{row.endedBy}</bdi> : null}
        </td>
        <td className={TD} data-ps-end-reason={view.endReason?.raw ?? ''}>
          <span className="flex flex-col gap-0.5">
            {view.endReason && (
              <span className="font-medium" data-ps-end-reason-text="">
                <Word word={view.endReason} />
              </span>
            )}
            {view.endNote && (
              <bdi className="text-muted-foreground" data-ps-end-note="">
                {view.endNote}
              </bdi>
            )}
          </span>
        </td>
        <td className={TD} data-ps-sales="">
          <span className="flex flex-wrap items-center gap-1.5">
            {view.neverInvoiced ? (
              <span className="text-muted-foreground" data-ps-never-invoiced="">
                {t('ended.neverInvoiced')}
              </span>
            ) : (
              view.sales.map((sale) => (
                <span key={sale} className={code} data-ps-sale={sale}>
                  <Ltr>{sale}</Ltr>
                </span>
              ))
            )}
            {view.wasOwed && (
              <span data-ps-was-owed="">
                <StatusBadge sev="warn">{t('ended.wasOwed')}</StatusBadge>
              </span>
            )}
          </span>
        </td>
      </tr>
      {hasAfter && (
        <tr className="border-b border-border/60" data-ps-ended-after={row.sessionId}>
          <td colSpan={COLUMNS} className="px-3 pb-2">
            <ul className="flex flex-col gap-1 border-s-2 border-border/60 ps-3 text-xs" aria-label={t('ended.afterCloseLabel')}>
              {view.afterClose.map((line, i) => (
                <li key={i}>
                  <AfterCloseText line={line} />
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}
