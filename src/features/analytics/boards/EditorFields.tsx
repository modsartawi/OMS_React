import type { Dispatch, SetStateAction } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Ban, Info } from 'lucide-react'
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
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import MultiSelect from '@/core/ui/MultiSelect'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { LEGEND_POSITIONS, NUMBER_FORMATS, PERIODS, pickableMeasures } from './editor'
import { periodNameKey } from './periods'
import type { ChartChoice, ChartOffer } from './shape-rules'

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
}) {
  const { t } = useTranslation('boards')
  const unavailableAreas = model.areas.filter((a) => !a.available)
  return (
    <>
          <Field label={t('editor.measures')} invalid={invalid.measure}>
            <MultiSelect
              label={t('editor.measures')}
              value={measures}
              onChange={onMeasures}
              options={pickableMeasures(model).map((m) => ({ value: m.key, text: saysIn(m.label, lang) || m.key }))}
              data-testid="editor-measures"
            />
          </Field>
          {unavailableAreas.length > 0 && (
            <div className="-mt-2 text-xs text-muted-foreground" data-analytics-unavailable-areas>
              <span className="font-medium">{t('editor.unavailableAreas')}</span>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {unavailableAreas.map((a) => (
                  <li key={a.key} data-analytics-unavailable-area={a.key}>
                    <Trans
                      t={t}
                      i18nKey="editor.areaReason"
                      values={{ area: a.key, reason: fsi(a.unavailableReason ?? '') }}
                      components={{ area: <Ltr /> }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Field label={t('editor.dimensions')} hint={t('editor.dimensionsHint')} invalid={invalid.dimension}>
            <MultiSelect
              label={t('editor.dimensions')}
              value={dimensions}
              onChange={onDimensions}
              options={allowed.map((d) => ({ value: d.key, text: saysIn(d.label, lang) || d.key }))}
              data-testid="editor-dimensions"
            />
          </Field>

          {allowed
            .filter((d) => d.values.length > 0)
            .map((d) => (
              <Field key={d.key} label={t('editor.filterOn', { dimension: fsi(saysIn(d.label, lang) || d.key) })}>
                <MultiSelect
                  label={t('editor.filterOn', { dimension: fsi(saysIn(d.label, lang) || d.key) })}
                  value={filters.find((f) => f.dimension === d.key)?.values ?? []}
                  onChange={(values) => onFilter(d.key, values)}
                  options={d.values.map((v) => ({ value: v.key, text: saysIn(v.label, lang) || v.key }))}
                  data-testid={`editor-filter-${d.key}`}
                />
              </Field>
            ))}

          <Field label={t('editor.period')}>
            <Select value={period} onChange={(e) => onPeriod(e.target.value)} data-editor-period>
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(periodNameKey(p))}
                </option>
              ))}
            </Select>
          </Field>
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
}: {
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
            <p className="text-xs text-muted-foreground">{t('editor.chartHint')}</p>
            {offer?.offered && offer.folds && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground" data-analytics-folds>
                <Info className="size-3.5" aria-hidden />
                {t('editor.folds')}
              </p>
            )}
            {measures.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground" data-analytics-why-not>
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
