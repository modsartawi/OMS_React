import { useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Ban, Info, Sparkles } from 'lucide-react'
import type {
  AnalyticsChart,
  AnalyticsDimension,
  AnalyticsFilter,
  AnalyticsLabel,
  AnalyticsLegendPosition,
  AnalyticsModel,
  AnalyticsNumberFormat,
} from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import MultiSelect from '@/core/ui/MultiSelect'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import {
  comparesToPrevious,
  DEFAULT_PERIOD,
  dimensionRole,
  filterableDimensions,
  GRAINS,
  LEGEND_POSITIONS,
  moveDimension,
  NUMBER_FORMATS,
  PERIODS,
  rangePeriod,
  rangeProblem,
  readRange,
  type Grain,
} from './editor'
import MeasurePicker from './MeasurePicker'
import { periodNameKey, resolvePeriod } from './periods'
import SearchFilterField from './SearchFilterField'
import type { ChartChoice, ChartOffer } from './shape-rules'
import { dimensionOf } from './wire'

/**
 * The view editor's field panels (ticket 775), split out of `AnalyticsEditorPage` as thin renderers: the query
 * (measures, breakdowns, filters, period), the chart (type offers and their reasons, format, legend, sort, top N)
 * and the bilingual title and subtitle. The editor owns every value; these only draw and report changes.
 */

export function QueryFields({
  model,
  lang,
  measures,
  onMeasures,
  dimensions,
  onDimensions,
  allowed,
  filters,
  onFilter,
  period,
  onPeriod,
  invalid,
  grain,
  onGrain,
}: {
  model: AnalyticsModel
  lang: string
  measures: string[]
  onMeasures: (next: string[]) => void
  dimensions: string[]
  onDimensions: (next: string[]) => void
  /** The breakdowns every chosen measure allows. */
  allowed: AnalyticsDimension[]
  filters: AnalyticsFilter[]
  onFilter: (dimension: string, values: string[]) => void
  period: string
  onPeriod: (period: string) => void
  /** A 406 that names this section's field. */
  invalid: { measure: boolean; dimension: boolean }
  /** The date breakdown's grain (shown only with a date breakdown). */
  grain: Grain
  onGrain: (grain: Grain) => void
}) {
  const { t } = useTranslation('boards')
  const label = (d: AnalyticsDimension | undefined, key: string) => saysIn(d?.label, lang) || key
  const hasTime = dimensions.some((k) => dimensionOf(model, k)?.kind === 'time')
  return (
    <>
      <MeasurePicker model={model} lang={lang} value={measures} onChange={onMeasures} invalid={invalid.measure} />

      <Field label={t('editor.dimensions')} hint={t('editor.dimensionsHint')} invalid={invalid.dimension}>
        <MultiSelect
          label={t('editor.dimensions')}
          value={dimensions}
          onChange={onDimensions}
          options={allowed.map((d) => ({ value: d.key, text: label(d, d.key) }))}
          data-testid="editor-dimensions"
        />
      </Field>
      {dimensions.length >= 2 && (
        // The order is the chart's: the first breakdown is the axis, the second the series (colours).
        <ol className="-mt-2 flex flex-col gap-1 rounded-md bg-muted/50 p-2 text-xs" data-analytics-dimension-order>
          {dimensions.map((k, i) => (
            <li key={k} className="flex items-center gap-2" data-analytics-dimension-at={i}>
              <span className="w-28 shrink-0 text-muted-foreground">{t(`editor.role.${dimensionRole(i)}`)}</span>
              <span className="min-w-0 flex-1 truncate font-medium">
                <bdi>{label(dimensionOf(model, k), k)}</bdi>
              </span>
              <IconButton
                label={t('editor.moveUp', { dimension: fsi(label(dimensionOf(model, k), k)) })}
                size="compact"
                disabled={i === 0}
                onClick={() => onDimensions(moveDimension(dimensions, i, -1))}
              >
                <ArrowUp className="size-3.5" aria-hidden />
              </IconButton>
              <IconButton
                label={t('editor.moveDown', { dimension: fsi(label(dimensionOf(model, k), k)) })}
                size="compact"
                disabled={i === dimensions.length - 1}
                onClick={() => onDimensions(moveDimension(dimensions, i, 1))}
              >
                <ArrowDown className="size-3.5" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ol>
      )}
      {hasTime && (
        <Field label={t('editor.grain')}>
          <Select value={grain} onChange={(e) => onGrain(e.target.value as Grain)} data-editor-grain>
            {GRAINS.map((g) => (
              <option key={g} value={g}>
                {t(`editor.grainName.${g}`)}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <FilterFields allowed={allowed} lang={lang} filters={filters} onFilter={onFilter} />

      <PeriodFields period={period} onPeriod={onPeriod} />
    </>
  )
}

/**
 * Filters, added one at a time: the filters that hold values, plus an "Add a filter on…" picker for the rest. A
 * small fixed list (channel, slot outcome) ticks its values; an open one (store, city, region) searches its members.
 */
function FilterFields({
  allowed,
  lang,
  filters,
  onFilter,
}: {
  allowed: AnalyticsDimension[]
  lang: string
  filters: AnalyticsFilter[]
  onFilter: (dimension: string, values: string[]) => void
}) {
  const { t } = useTranslation('boards')
  const [added, setAdded] = useState<string[]>([])
  const values = (key: string) => filters.find((f) => f.dimension === key)?.values ?? []
  const all = filterableDimensions(allowed)
  const shown = all.filter((d) => added.includes(d.key) || values(d.key).length > 0)
  const rest = all.filter((d) => !shown.includes(d))
  const label = (d: AnalyticsDimension) => saysIn(d.label, lang) || d.key
  return (
    <div className="flex flex-col gap-3" data-analytics-filters>
      {shown.map((d) =>
        d.values.length > 0 ? (
          <Field key={d.key} label={t('editor.filterOn', { dimension: fsi(label(d)) })}>
            <MultiSelect
              label={t('editor.filterOn', { dimension: fsi(label(d)) })}
              value={values(d.key)}
              onChange={(v) => onFilter(d.key, v)}
              options={d.values.map((v) => ({ value: v.key, text: saysIn(v.label, lang) || v.key }))}
              data-testid={`editor-filter-${d.key}`}
            />
          </Field>
        ) : (
          <SearchFilterField key={d.key} dimension={d} lang={lang} value={values(d.key)} onChange={(v) => onFilter(d.key, v)} />
        ),
      )}
      {rest.length > 0 && (
        <Field label={shown.length ? t('editor.addAnotherFilter') : t('editor.filters')}>
          <Select value="" onChange={(e) => e.target.value && setAdded((a) => [...a, e.target.value])} data-editor-add-filter>
            <option value="">{t('editor.addFilter')}</option>
            {rest.map((d) => (
              <option key={d.key} value={d.key}>
                {label(d)}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  )
}

const CUSTOM = 'custom'

/** The period: a relative token, or a custom range of two days (the wire's `from..to`). */
function PeriodFields({ period, onPeriod }: { period: string; onPeriod: (period: string) => void }) {
  const { t } = useTranslation('boards')
  const saved = readRange(period)
  const [custom, setCustom] = useState(!!saved)
  const [range, setRange] = useState(() => saved ?? resolvePeriod(DEFAULT_PERIOD, new Date()))
  const problem = rangeProblem(range.from, range.to)
  const setDay = (end: 'from' | 'to', value: string) => {
    const next = { ...range, [end]: value }
    setRange(next)
    if (!rangeProblem(next.from, next.to)) onPeriod(rangePeriod(next.from, next.to))
  }
  return (
    <>
      <Field label={t('editor.periodLabel')}>
        <Select
          value={custom ? CUSTOM : period}
          onChange={(e) => {
            if (e.target.value === CUSTOM) {
              setCustom(true)
              if (!rangeProblem(range.from, range.to)) onPeriod(rangePeriod(range.from, range.to))
            } else {
              setCustom(false)
              onPeriod(e.target.value)
            }
          }}
          data-editor-period
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {t(periodNameKey(p))}
            </option>
          ))}
          <option value={CUSTOM}>{t('editor.customRange')}</option>
        </Select>
      </Field>
      {custom && (
        <div className="-mt-2 grid grid-cols-2 gap-3" data-editor-custom-range>
          <Field label={t('editor.rangeFrom')} invalid={problem === 'reversed'}>
            <Input type="date" dir="ltr" value={range.from} max={range.to || undefined} onChange={(e) => setDay('from', e.target.value)} data-editor-range="from" />
          </Field>
          <Field label={t('editor.rangeTo')} invalid={problem === 'reversed'}>
            <Input type="date" dir="ltr" value={range.to} min={range.from || undefined} onChange={(e) => setDay('to', e.target.value)} data-editor-range="to" />
          </Field>
          <p className="col-span-2 text-xs text-muted-foreground">{t(problem ? `editor.rangeProblem.${problem}` : 'editor.rangeHint')}</p>
        </div>
      )}
    </>
  )
}

export function ChartFields({
  offers,
  chosen,
  onChoose,
  invalid,
  measures,
  measureName,
  settings,
  onSettings,
  compare,
  onCompare,
  suggested = false,
}: {
  /** The chosen type was picked by the builder (nothing picked yet, or the pick no longer fits). */
  suggested?: boolean
  offers: ChartOffer[]
  /** The chosen type when the selection still fits it. */
  chosen: ChartChoice | null
  onChoose: (choice: ChartChoice) => void
  /** A 406 that names the chart. */
  invalid: boolean
  measures: string[]
  measureName: (key: string) => string
  settings: AnalyticsChart
  onSettings: Dispatch<SetStateAction<AnalyticsChart>>
  /** Compare with the previous period (stored only where the chosen type offers it). */
  compare: boolean
  onCompare: (on: boolean) => void
}) {
  const { t } = useTranslation('boards')
  const offer = chosen ? offers.find((o) => o.choice === chosen) : undefined
  const sortValue = settings.sort ? `${settings.sort.key}:${settings.sort.direction}` : ''
  return (
    <>
      <fieldset className="flex flex-col gap-2" data-analytics-chart-types aria-invalid={invalid || undefined}>
        <legend className="text-xs font-medium text-muted-foreground">{t('editor.chart')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {offers.map((o) => (
            <Chip
              key={o.choice}
              on={chosen === o.choice}
              aria-disabled={!o.offered || undefined}
              title={o.offered ? undefined : t(`editor.why.${o.reason}`)}
              onClick={() => o.offered && onChoose(o.choice)}
              data-analytics-choice={o.choice}
              data-offered={o.offered ? 'yes' : 'no'}
            >
              {t(`editor.choice.${o.choice}`)}
            </Chip>
          ))}
        </div>
        {suggested && chosen ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground" data-analytics-suggested={chosen}>
            <Sparkles className="size-3.5" aria-hidden />
            {t('editor.suggested', { chart: fsi(t(`editor.choice.${chosen}`)) })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('editor.chartHint')}</p>
        )}
        {comparesToPrevious(chosen) && (
          // 766 story 23: compare with the previous period, where the chosen type shows it (KPI, line).
          <div className="flex flex-wrap items-center gap-2">
            <Chip on={compare} onClick={() => onCompare(!compare)} data-editor-compare={compare ? 'on' : 'off'}>
              {t('editor.compare')}
            </Chip>
            <span className="text-xs text-muted-foreground">{t(chosen === 'kpi' ? 'editor.compareHintKpi' : 'editor.compareHintLine')}</span>
          </div>
        )}
        {offer?.offered && offer.folds && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground" data-analytics-folds>
            <Info className="size-3.5" aria-hidden />
            {t('editor.folds')}
          </p>
        )}
        {measures.length > 0 && offers.some((o) => !o.offered) && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">{t('editor.whyOff', { n: offers.filter((o) => !o.offered).length })}</summary>
          <ul className="mt-1 flex flex-col gap-0.5" data-analytics-why-not>
            {offers.map((o) =>
              o.offered ? null : (
                <li key={o.choice} className="flex gap-1" data-analytics-why={o.choice}>
                  <Ban className="mt-0.5 size-3 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium text-foreground">{t(`editor.choice.${o.choice}`)}</span> {t(`editor.why.${o.reason}`)}
                  </span>
                </li>
              ),
            )}
          </ul>
          </details>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('editor.format')}>
          <Select
            value={settings.format ?? 'auto'}
            onChange={(e) => onSettings((s) => ({ ...s, format: e.target.value as AnalyticsNumberFormat }))}
            data-editor-format
          >
            {NUMBER_FORMATS.map((f) => (
              <option key={f} value={f}>
                {t(`editor.formatName.${f}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('editor.legend')}>
          <Select
            value={settings.legend ?? 'bottom'}
            onChange={(e) => onSettings((s) => ({ ...s, legend: e.target.value as AnalyticsLegendPosition }))}
            data-editor-legend
          >
            {LEGEND_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {t(`editor.legendName.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('editor.sort')}>
          <Select
            value={sortValue}
            onChange={(e) => {
              const [key, direction] = e.target.value.split(':')
              onSettings((s) => ({ ...s, sort: key ? { key, direction: direction === 'asc' ? 'asc' : 'desc' } : null }))
            }}
            data-editor-sort
          >
            <option value="">{t('editor.sortDefault')}</option>
            {measures.flatMap((m) => [
              <option key={`${m}:desc`} value={`${m}:desc`}>
                {t('editor.sortDesc', { column: fsi(measureName(m)) })}
              </option>,
              <option key={`${m}:asc`} value={`${m}:asc`}>
                {t('editor.sortAsc', { column: fsi(measureName(m)) })}
              </option>,
            ])}
          </Select>
        </Field>
        <Field label={t('editor.topN')}>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={settings.topN ?? ''}
            placeholder={t('editor.topNPlaceholder')}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              onSettings((s) => ({ ...s, topN: Number.isFinite(n) && n > 0 ? n : null }))
            }}
            data-editor-top-n
          />
        </Field>
      </div>
    </>
  )
}

export function TitleFields({
  title,
  onTitle,
  subtitle,
  onSubtitle,
  generated,
}: {
  title: AnalyticsLabel
  onTitle: Dispatch<SetStateAction<AnalyticsLabel>>
  subtitle: AnalyticsLabel
  onSubtitle: Dispatch<SetStateAction<AnalyticsLabel>>
  /** The generated title in each language: the placeholder an empty title falls back to. */
  generated: AnalyticsLabel
}) {
  const { t } = useTranslation('boards')
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t('editor.titleEn')} hint={t('editor.titleHint')}>
        <Input value={title.en} dir="ltr" placeholder={generated.en} onChange={(e) => onTitle((x) => ({ ...x, en: e.target.value }))} data-editor-title="en" />
      </Field>
      <Field label={t('editor.titleAr')}>
        <Input value={title.ar} dir="rtl" placeholder={generated.ar} onChange={(e) => onTitle((x) => ({ ...x, ar: e.target.value }))} data-editor-title="ar" />
      </Field>
      <Field label={t('editor.subtitleEn')}>
        <Input value={subtitle.en} dir="ltr" onChange={(e) => onSubtitle((x) => ({ ...x, en: e.target.value }))} data-editor-subtitle="en" />
      </Field>
      <Field label={t('editor.subtitleAr')}>
        <Input value={subtitle.ar} dir="rtl" onChange={(e) => onSubtitle((x) => ({ ...x, ar: e.target.value }))} data-editor-subtitle="ar" />
      </Field>
    </div>
  )
}
