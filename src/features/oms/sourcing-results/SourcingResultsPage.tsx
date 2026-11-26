import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import {
  RESULTS_CHANNEL_GROUPS,
  RESULTS_PERIODS,
  RESULTS_RUN_MARKS,
  type ResultsFigure,
  type ResultsSummaryReply,
} from '@/core/models/sourcing-results'
import { canViewSourcingAdvisor } from '@/core/sourcing-advisor/access'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { sourcingResultsApi } from './api'
import DifferTable from './DifferTable'
import { DrillProvider } from './Drill'
import { filtersFromParams, filtersToParams, resultsQuery, setFromKey, setKey, type ResultsFilters } from './filters'
import OrdersDrawer from './OrdersDrawer'
import Panels from './Panels'
import ResultsBar from './ResultsBar'
import ResultsTabs from './ResultsTabs'

/**
 * The comparison results page (ticket 971, BackOffice spec 4354 §16–§17, results ticket 4282 and its amendments): how
 * the advisor's plans compare with what routing did. On top one sentence and one bar; under it the promise check, cost
 * and the marks in force; then "Where the plans differ"; then the seven tabs (972 and 973 fill them). Any underlined
 * figure opens its orders in the drawer.
 *
 * Behind today's advisor view grant (`canViewSourcingAdvisor`, `SourcingAdvisor:01`), as the results doors are
 * (BO 4393). 🚩 Built on stubs: the doors are not specified (`./api`). No riyal total, no green and no red.
 */
export default function SourcingResultsPage() {
  const { t } = useTranslation('sourcing-results')
  return (
    <ScreenGate can={canViewSourcingAdvisor} ns="sourcing-results" title={t('title')} subtitle={t('subtitle')}>
      <Results />
    </ScreenGate>
  )
}

function Results() {
  const { t } = useTranslation('sourcing-results')
  const { query: filters, update } = useUrlQuery(filtersFromParams, filtersToParams)
  const patch = (p: Partial<ResultsFilters>) => update((prev) => ({ ...prev, ...p }))
  const wire = useMemo(() => resultsQuery(filters), [filters])
  const [figure, setFigure] = useState<ResultsFigure | null>(null)

  const summary = useQuery({
    queryKey: ['sourcing-results', 'summary', wire],
    queryFn: () => sourcingResultsApi.summary(wire),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const data = summary.data

  return (
    <DrillProvider open={setFigure}>
      <div className="flex w-full max-w-7xl min-w-0 flex-col gap-4" data-sourcing-results="">
        <FilterBar filters={filters} summary={data} onChange={patch} />

        {summary.isError ? (
          <ErrorBanner title={t('load.failedTitle')} message={apiErrorMessage(summary.error, t('load.failed'))} />
        ) : !data ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('load.loading')}
          </p>
        ) : (
          <div className={`flex flex-col gap-4 ${summary.isFetching ? 'opacity-60' : ''}`} aria-busy={summary.isFetching}>
            <ResultsBar top={data.top} />
            <Panels promise={data.promise} cost={data.cost} marks={data.marks} />
            <DifferTable rows={data.differ} view={filters.view} onView={(view) => patch({ view })} />
            <ResultsTabs open={filters.tab} onSelect={(tab) => patch({ tab })} query={wire} summary={data} />
          </div>
        )}

        {figure && <OrdersDrawer figure={figure} query={wire} onClose={() => setFigure(null)} />}
      </div>
    </DrillProvider>
  )
}

function FilterBar({
  filters,
  summary,
  onChange,
}: {
  filters: ResultsFilters
  summary: ResultsSummaryReply | undefined
  onChange: (p: Partial<ResultsFilters>) => void
}) {
  const { t } = useTranslation('sourcing-results')
  const sets = summary?.sets ?? []
  const setLabel = (s: { name: string; version: number; candidate?: boolean; trial?: boolean }) =>
    t(s.trial ? 'filters.setTrial' : s.candidate ? 'filters.setCandidate' : 'filters.set', { name: fsi(s.name), version: fsi(s.version) })
  const toggleMark = (mark: (typeof RESULTS_RUN_MARKS)[number]) =>
    onChange({ marks: filters.marks.includes(mark) ? filters.marks.filter((m) => m !== mark) : [...filters.marks, mark] })

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3" data-results-filters="">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('filters.period')}>
          {RESULTS_PERIODS.map((p) => (
            <Chip key={p} on={filters.period === p} onClick={() => onChange({ period: p })} data-period={p}>
              {t(`filters.periods.${p}`)}
            </Chip>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          {t('filters.channel')}
          <Select
            value={filters.channelGroup}
            onChange={(e) => onChange({ channelGroup: e.target.value as ResultsFilters['channelGroup'] })}
            className="w-72"
            data-filter="channel"
          >
            {RESULTS_CHANNEL_GROUPS.map((g) => (
              <option key={g} value={g}>
                {t(`filters.channelGroups.${g}`)}
              </option>
            ))}
          </Select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          {t('filters.candidateSet')}
          <Select value={setKey(filters.set)} onChange={(e) => onChange({ set: setFromKey(e.target.value) })} className="w-64" data-filter="set">
            <option value="">{summary ? setLabel(summary.candidate) : t('filters.theCandidate')}</option>
            {sets
              .filter((s) => !s.candidate)
              .map((s) => (
                <option key={setKey(s)} value={setKey(s)}>
                  {setLabel(s)}
                </option>
              ))}
          </Select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          {t('filters.beside')}
          <Select value={setKey(filters.beside)} onChange={(e) => onChange({ beside: setFromKey(e.target.value) })} className="w-64" data-filter="beside">
            <option value="">{t('filters.besideNone')}</option>
            {sets.map((s) => (
              <option key={setKey(s)} value={setKey(s)}>
                {setLabel(s)}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Chip on={filters.stockShortLine} onClick={() => onChange({ stockShortLine: !filters.stockShortLine })} data-filter="stock-short-line">
          {t('filters.stockShortLine')}
        </Chip>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('filters.marks')}>
          <span className="me-1 text-xs text-muted-foreground">{t('filters.marks')}</span>
          {RESULTS_RUN_MARKS.map((m) => (
            <Chip key={m} on={filters.marks.includes(m)} onClick={() => toggleMark(m)} data-run-mark={m}>
              {t(`filters.runMarks.${m}`)}
            </Chip>
          ))}
        </div>
        {summary && (
          <span className="ms-auto text-xs text-muted-foreground" data-results-period="">
            {t('filters.read', { from: fsi(summary.period.from), to: fsi(summary.period.to) })}
          </span>
        )}
      </div>
    </div>
  )
}
