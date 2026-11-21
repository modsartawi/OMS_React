import { useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ChartFrame from '@/core/charts/ChartFrame'
import KpiTile from '@/core/charts/KpiTile'
import SeriesChart from '@/core/charts/SeriesChart'
import { formatDay } from '@/core/charts/format'
import type { AnalyticsQueryResult, AnalyticsSemanticQuery } from '@/core/models/analytics'
import { PRICE_INDEX_ERRORS, type PriceWatchCoverage } from '@/core/models/price-watch'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { priceIndexApi, priceWatchSharedApi } from './api'
import {
  INDEX_GRAINS,
  INDEX_PERIODS,
  INDEX_TONE_SEVERITY,
  PRICE_BASES,
  answerBasis,
  categoryTable,
  competitorIndexes,
  formatIndex,
  indexByCategoryQuery,
  indexByCompetitorQuery,
  indexTone,
  indexTrend,
  indexTrendQuery,
  lowestPriceScore,
  scoreFigures,
  scoreQuery,
  scoreTrend,
  trendSlot,
  type IndexGrain,
  type IndexPeriod,
  type PriceBasis,
} from './index-tab'

const NS = 'price-command-center'
const NOT_YET = new Set<string>(Object.values(PRICE_INDEX_ERRORS))

/** One Cube read, keyed by what it asks, the previous answer kept on screen while the next one runs. */
function useCube(name: string, query: AnalyticsSemanticQuery) {
  return useQuery({
    queryKey: ['price-index', name, query],
    queryFn: () => priceIndexApi.query(query),
    retry: false,
    placeholderData: keepPreviousData,
  })
}

/**
 * The Index tab (oms 938, BackOffice spec 4127 decisions 5 and 8): the price index per competitor with us at 100 (above
 * 100 = they are dearer, below = they are cheaper, the warning), by A-level, over time; and the lowest-price score,
 * overall and per competitor, with its trend. Shelf or paid throughout. Read from Cube through `Analytics/Query`, so the
 * tab needs `Analytics:03` beside the PriceWatch view grant (`canViewPriceIndex`).
 *
 * ⚠ GUESSED (BO 4132, not built): the flipped index members and the lowest-price score members — see `index-tab.ts`.
 */
export default function IndexTab() {
  const { t, i18n } = useTranslation(NS)
  const locale = i18n.language
  const [basis, setBasis] = useState<PriceBasis>('shelf')
  const [period, setPeriod] = useState<IndexPeriod>('last-28-days')
  const [grain, setGrain] = useState<IndexGrain>('week')

  const coverage = useQuery({ queryKey: ['price-watch', 'coverage'], queryFn: () => priceWatchSharedApi.coverage(), retry: false })
  const byCompetitor = useCube('by-competitor', indexByCompetitorQuery(basis, period))
  const byCategory = useCube('by-category', indexByCategoryQuery(basis, period))
  const trend = useCube('trend', indexTrendQuery(basis, grain, period))
  const scoreAll = useCube('score-overall', scoreQuery(basis, 'overall', period))
  const scoreEach = useCube('score-competitor', scoreQuery(basis, 'competitor', period))
  const scoreOverTime = useCube('score-trend', scoreQuery(basis, grain, period))

  const name = competitorNamer(coverage.data ?? [])
  // Each answer is read on the basis it was asked on: while the switch's next answer runs, the kept one stays readable.
  const askedOn = (data: AnalyticsQueryResult | undefined): PriceBasis => answerBasis(data) ?? basis
  const scoreSpark = scoreOverTime.data
    ? scoreTrend(scoreOverTime.data, askedOn(scoreOverTime.data)).map((p) => ({ x: p.day, label: formatDay(p.day, locale), value: p.score }))
    : []
  const overall = scoreAll.data ? scoreFigures(scoreAll.data, askedOn(scoreAll.data))[0] : undefined

  return (
    <div className="flex flex-col gap-5" data-index-tab="" data-index-basis={basis}>
      <p className="text-sm text-muted-foreground">{t('index.intro')}</p>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border/60 bg-card/40 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('index.basis.label')}</span>
          <div role="group" aria-label={t('index.basis.label')} className="flex gap-1">
            {PRICE_BASES.map((b) => (
              <Chip key={b} on={basis === b} onClick={() => setBasis(b)} data-index-basis-chip={b}>
                {t(`index.basis.${b}`)}
              </Chip>
            ))}
          </div>
        </div>
        <Field label={t('index.period.label')} className="w-48">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as IndexPeriod)} data-index-period="">
            {INDEX_PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`index.period.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('index.trend.grain.label')}</span>
          <div role="group" aria-label={t('index.trend.grain.label')} className="flex gap-1">
            {INDEX_GRAINS.map((g) => (
              <Chip key={g} on={grain === g} onClick={() => setGrain(g)} data-index-grain={g}>
                {t(`index.trend.grain.${g}`)}
              </Chip>
            ))}
          </div>
        </div>
        <p className="basis-full text-xs text-muted-foreground" data-index-basis-hint="">
          {t(`index.basisHint.${basis}`)}
        </p>
      </div>

      <Section title={t('index.score.title')} explain={t('index.score.explain')} id="score">
        <Answer read={scoreAll}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-index-score-overall="">
            <ScoreTile label={t('index.score.overall')} flagged={overall?.flagged ?? null} counted={overall?.counted ?? null} spark={scoreSpark} />
          </div>
        </Answer>
        {/* Per competitor: its own read, so its loading or failure shows on its own, not hidden behind the overall one. */}
        <Answer read={scoreEach}>
          {scoreEach.data && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-index-score-each="">
              {scoreFigures(scoreEach.data, askedOn(scoreEach.data)).map((f) => (
                <ScoreTile key={f.competitor} label={name(f.competitor)} pair flagged={f.flagged} counted={f.counted} spark={[]} />
              ))}
            </div>
          )}
        </Answer>
        <h4 className="mt-3 text-sm font-medium">{t('index.score.trendTitle')}</h4>
        <p className="text-xs text-muted-foreground">{t('index.score.trendExplain')}</p>
        <Answer read={scoreOverTime}>
          <SeriesChart
            form="line"
            stacking="none"
            colourBy="single"
            series={[{ key: 'score', label: t('index.score.overall'), slot: 0, other: false, unit: 'share' }]}
            rows={scoreSpark.map((p) => ({ x: p.x, label: p.label, values: { score: p.value }, slot: null }))}
            unit="share"
            format="auto"
            locale={locale}
            ariaLabel={t('index.score.trendTitle')}
            height={220}
          />
        </Answer>
      </Section>

      <Section title={t('index.byCompetitor.title')} explain={t('index.byCompetitor.explain')} id="by-competitor">
        <Answer read={byCompetitor}>
          {byCompetitor.data && (
            <table className="w-full max-w-2xl text-sm" data-index-by-competitor="">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-1.5 text-start font-medium">{t('index.byCompetitor.competitor')}</th>
                  <th className="py-1.5 text-start font-medium">{t('index.byCompetitor.index')}</th>
                  <th className="py-1.5 text-end font-medium">{t('index.byCompetitor.materials')}</th>
                </tr>
              </thead>
              <tbody>
                {competitorIndexes(byCompetitor.data, askedOn(byCompetitor.data)).map((row) => (
                  <tr key={row.competitor} className="border-b border-border/50" data-index-competitor={row.competitor}>
                    <td className="py-1.5">
                      <Ltr>{name(row.competitor)}</Ltr>
                    </td>
                    <td className="py-1.5">
                      <IndexFigure index={row.index} />
                    </td>
                    <td className="py-1.5 text-end tabular-nums">
                      <Ltr>{row.materials === null ? '' : formatFigure(row.materials)}</Ltr>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Answer>
      </Section>

      <Section title={t('index.byCategory.title')} explain={t('index.byCategory.explain')} id="by-category">
        <Answer read={byCategory}>
          {byCategory.data && <CategoryTableView table={categoryTable(byCategory.data, askedOn(byCategory.data))} name={name} />}
        </Answer>
      </Section>

      <Section title={t('index.trend.title')} explain={t('index.trend.explain')} id="trend">
        <Answer read={trend}>
          {trend.data && <TrendChart trend={trend.data} basis={askedOn(trend.data)} name={name} locale={locale} label={t('index.trend.title')} />}
        </Answer>
      </Section>
    </div>
  )
}

/** A competitor's name off the coverage list, beside its code ("NAHDI · Nahdi"); the bare code when unknown. */
function competitorNamer(coverage: readonly PriceWatchCoverage[]) {
  const names = new Map(coverage.map((c) => [c.competitorCode, c.competitorName]))
  return (code: string): string => {
    const known = names.get(code)
    return known ? formatPair(code, known) : code
  }
}

function Section({ title, explain, id, children }: { title: string; explain: string; id: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" data-index-section={id}>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground" data-index-explain={id}>
        {explain}
      </p>
      {children}
    </section>
  )
}

/** One Cube read's states: loading, refused (the model not holding the figures yet reads as such), empty, or the answer. */
function Answer({
  read,
  children,
}: {
  read: { data?: AnalyticsQueryResult; error: unknown; isError: boolean; isFetching: boolean }
  children: ReactNode
}) {
  const { t } = useTranslation(NS)
  if (read.isError) {
    const code = apiErrorCode(read.error)
    const message = code && NOT_YET.has(code) ? t('index.notYet') : apiErrorMessage(read.error, t('index.failedHint'))
    return <ErrorBanner title={t('index.failed')} message={message} />
  }
  if (!read.data) return <ChartFrame busy hasChart={false} />
  if (read.data.rows.length === 0) return <p className="text-sm text-muted-foreground">{t('index.empty')}</p>
  return (
    <ChartFrame busy={read.isFetching} hasChart>
      {children}
    </ChartFrame>
  )
}

/** One index figure with its tone: above 100 "they are dearer" (fine), below 100 "they are cheaper" (the warning). */
export function IndexFigure({ index }: { index: number | null }) {
  const { t } = useTranslation(NS)
  const tone = indexTone(index)
  if (tone === null) return <span className="text-muted-foreground">{t('index.noFigure')}</span>
  const sev = INDEX_TONE_SEVERITY[tone]
  return (
    <span className="inline-flex items-center gap-2" data-index-tone={tone} data-index-sev={sev}>
      <span className="font-semibold tabular-nums">
        <Ltr>{formatIndex(index)}</Ltr>
      </span>
      <StatusBadge sev={sev}>{t(`index.tone.${tone}`)}</StatusBadge>
    </span>
  )
}

/**
 * A lowest-price score tile: flagged ÷ counted as a percent, with the two counts under it. A competitor's label is a
 * `code · name` pair (`pair`), a machine value isolated LTR like the tables; the overall label is a sentence.
 */
export function ScoreTile({
  label,
  pair = false,
  flagged,
  counted,
  spark,
}: {
  label: string
  pair?: boolean
  flagged: number | null
  counted: number | null
  spark: readonly { x: string; label: string; value: number | null }[]
}) {
  const { t, i18n } = useTranslation(NS)
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3" data-index-score-tile="">
      <div className="text-sm font-medium">{pair ? <Ltr>{label}</Ltr> : <bdi>{label}</bdi>}</div>
      <KpiTile
        measureLabel={label}
        value={lowestPriceScore(flagged, counted)}
        previous={null}
        delta={null}
        spark={spark}
        unit="share"
        format="auto"
        locale={i18n.language}
      />
      {flagged !== null && counted !== null && (
        <p className="text-xs text-muted-foreground" data-index-score-counts="">
          <Trans
            t={t}
            i18nKey="index.score.counted"
            values={{ flagged: formatFigure(flagged), counted: formatFigure(counted) }}
            components={{ f: <Ltr />, c: <Ltr /> }}
          />
        </p>
      )}
    </div>
  )
}

function CategoryTableView({ table, name }: { table: ReturnType<typeof categoryTable>; name: (code: string) => string }) {
  const { t } = useTranslation(NS)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-index-by-category="">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="py-1.5 pe-3 text-start font-medium">{t('index.byCategory.category')}</th>
            {table.competitors.map((c) => (
              <th key={c} className="py-1.5 pe-3 text-start font-medium">
                <Ltr>{name(c)}</Ltr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.category} className="border-b border-border/50" data-index-category={row.category}>
              <td className="py-1.5 pe-3">
                <bdi>{row.category}</bdi>
              </td>
              {table.competitors.map((c) => (
                <td key={c} className="py-1.5 pe-3">
                  <IndexFigure index={row.cells[c] ?? null} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrendChart({
  trend,
  basis,
  name,
  locale,
  label,
}: {
  trend: AnalyticsQueryResult
  basis: PriceBasis
  name: (code: string) => string
  locale: string
  label: string
}) {
  const { competitors, points } = indexTrend(trend, basis)
  return (
    <SeriesChart
      form="line"
      stacking="none"
      colourBy="member"
      series={competitors.map((c, i) => ({ key: c, label: name(c), slot: trendSlot(i), other: false, unit: 'count' }))}
      rows={points.map((p) => ({ x: p.day, label: formatDay(p.day, locale), values: p.values, slot: null }))}
      unit="count"
      format="decimal"
      locale={locale}
      ariaLabel={label}
      height={280}
    />
  )
}
