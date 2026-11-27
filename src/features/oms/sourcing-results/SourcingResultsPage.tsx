import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import {
  RESULTS_CHANNEL_GROUPS,
  RESULTS_PERIODS,
  RESULTS_RUN_MARKS,
  type ResultsEcho,
  type ResultsFigure,
  type ResultsPanelsReply,
  type ResultsRunMark,
  type TrialReply,
} from '@/core/models/sourcing-results'
import { canViewSourcingAdvisor } from '@/core/sourcing-advisor/access'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { sourcingResultsApi, TRIALS_KEY } from './api'
import BesideSection from './BesideSection'
import DifferTable from './DifferTable'
import { DrillProvider } from './Drill'
import { filtersFromParams, filtersToParams, resultsQuery, setFromKey, setKey, type ResultsFilters, type SetPick } from './filters'
import OrdersDrawer from './OrdersDrawer'
import Panels from './Panels'
import ResultsBar from './ResultsBar'
import ResultsTabs from './ResultsTabs'

/**
 * The comparison results page (ticket 971, BackOffice spec 4354 §16–§17, results ticket 4282 and its amendments): how
 * the advisor's plans compare with what routing did. On top one sentence and one bar; under it the promise check, cost
 * and the marks in force; then "Where the plans differ"; then the seven tabs (972 and 973). Any underlined figure
 * opens its orders in the drawer.
 *
 * Behind the advisor view grant (`canViewSourcingAdvisor`, `SourcingAdvisor:01`), as the results doors are (BO 4393,
 * 4397). The first screen reads three doors — `Results/Top`, `Results/Panels`, `Results/Differ?view=` — which share
 * the server's cached rows for the period. No riyal total, no green and no red.
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

  const read = { placeholderData: keepPreviousData, retry: false } as const
  const top = useQuery({ queryKey: ['sourcing-results', 'top', wire], queryFn: () => sourcingResultsApi.top(wire), ...read })
  const panels = useQuery({ queryKey: ['sourcing-results', 'panels', wire], queryFn: () => sourcingResultsApi.panels(wire), ...read })
  const differ = useQuery({
    queryKey: ['sourcing-results', 'differ', wire, filters.view],
    queryFn: () => sourcingResultsApi.differ(wire, filters.view),
    ...read,
  })
  const failed = top.error ?? panels.error ?? differ.error

  return (
    <DrillProvider open={setFigure}>
      <div className="flex w-full max-w-7xl min-w-0 flex-col gap-4" data-sourcing-results="">
        <FilterBar filters={filters} echo={top.data?.filter} panels={panels.data} onChange={patch} />

        {failed ? (
          <ErrorBanner title={t('load.failedTitle')} message={apiErrorMessage(failed, t('load.failed'))} />
        ) : !top.data ? (
          <Loading />
        ) : (
          <div className={`flex flex-col gap-4 ${top.isFetching ? 'opacity-60' : ''}`} aria-busy={top.isFetching}>
            <ResultsBar top={top.data} />
            {filters.beside && <BesideSection pick={filters.beside} onClear={() => patch({ beside: null })} />}
            {panels.data ? <Panels panels={panels.data} /> : <Loading />}
            {differ.data ? <DifferTable reply={differ.data} view={filters.view} onView={(view) => patch({ view })} /> : <Loading />}
            <ResultsTabs open={filters.tab} onSelect={(tab) => patch({ tab })} query={wire} />
          </div>
        )}

        {figure && <OrdersDrawer figure={figure} query={wire} onClose={() => setFigure(null)} />}
      </div>
    </DrillProvider>
  )
}

function Loading() {
  const { t } = useTranslation('sourcing-results')
  return (
    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {t('load.loading')}
    </p>
  )
}

/** `yyyy-MM-dd` of a wire time, local, as sent. */
const dayOf = (time: string) => time.slice(0, 10)
/** The last whole day before an exclusive end (`to` is local midnight after the period). */
function dayBefore(time: string): string {
  const d = new Date(Date.UTC(Number(time.slice(0, 4)), Number(time.slice(5, 7)) - 1, Number(time.slice(8, 10)) - 1))
  return d.toISOString().slice(0, 10)
}

/**
 * The sets a reader may pick. SERVER GAP (spec 4354) — no results door lists the weight sets (the list is the run
 * grant's, `WeightSets`); the picker offers the set the cost panel reads (the one most of the period's orders ran on),
 * the sets of the kept trials (read under the view grant) and the one in the address.
 */
function setsOf(panels: ResultsPanelsReply | undefined, trials: TrialReply[] | undefined, picked: SetPick): NonNullable<SetPick>[] {
  const all: NonNullable<SetPick>[] = []
  const add = (s: SetPick) => s && !all.some((x) => setKey(x) === setKey(s)) && all.push(s)
  if (panels?.cost.setName && panels.cost.setVersion) add({ name: panels.cost.setName, version: panels.cost.setVersion })
  for (const tr of trials ?? []) {
    if (!tr.factorOff) add({ name: tr.name, version: tr.version })
    if (tr.besideCandidate) add({ name: tr.besideCandidate, version: tr.besideCandidateVersion })
  }
  add(picked)
  return all
}

function FilterBar({
  filters,
  echo,
  panels,
  onChange,
}: {
  filters: ResultsFilters
  echo: ResultsEcho | undefined
  panels: ResultsPanelsReply | undefined
  onChange: (p: Partial<ResultsFilters>) => void
}) {
  const { t } = useTranslation('sourcing-results')
  const trials = useQuery({ queryKey: TRIALS_KEY, queryFn: sourcingResultsApi.trials, retry: false })
  const sets = setsOf(panels, trials.data, filters.set)
  const besideTrial = filters.beside ? trials.data?.find((x) => x.trialId === filters.beside?.beside) : undefined

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
            <option value="">{t('filters.everySet')}</option>
            {sets.map((s) => (
              <option key={setKey(s)} value={setKey(s)}>
                {t('filters.set', { name: fsi(s.name), version: fsi(s.version) })}
              </option>
            ))}
          </Select>
        </label>
        <div className="inline-flex items-center gap-2 text-sm" data-filter="beside">
          {t('filters.beside')}
          {filters.beside ? (
            <>
              <b>
                {besideTrial ? t('filters.set', { name: fsi(besideTrial.name), version: fsi(besideTrial.version) }) : t('filters.besideTrial')}
              </b>
              <Button variant="secondary" onClick={() => onChange({ beside: null })} aria-label={t('beside.clear')} data-filter-beside-clear="">
                <X className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => onChange({ tab: 'trials' })} data-filter-beside-pick="">
              {t('filters.besidePick')}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Chip on={filters.shortFigure} onClick={() => onChange({ shortFigure: !filters.shortFigure })} data-filter="short-figure">
          {t('filters.shortFigure')}
        </Chip>
        <label className="inline-flex items-center gap-2 text-sm">
          {t('filters.runMark')}
          <Select
            value={filters.runMark ?? ''}
            onChange={(e) => onChange({ runMark: (e.target.value || null) as ResultsRunMark | null })}
            className="w-64"
            data-filter="run-mark"
          >
            <option value="">{t('filters.anyRunMark')}</option>
            {RESULTS_RUN_MARKS.map((m) => (
              <option key={m} value={m}>
                {t(`filters.runMarks.${m}`)}
              </option>
            ))}
          </Select>
        </label>
        {echo && (
          <span className="ms-auto text-xs text-muted-foreground" data-results-period="">
            {t('filters.read', { from: fsi(dayOf(echo.from)), to: fsi(dayBefore(echo.to)) })}
          </span>
        )}
      </div>
    </div>
  )
}
