import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy, TriangleAlert } from 'lucide-react'
import type { AnalyticsChart, AnalyticsLabel, AnalyticsModel, AnalyticsReportDefinition } from '@/core/models/analytics'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { analyticsApi, analyticsItemKey } from './api'
import { canBind } from './bindings'
import CalculationFields from './CalculationFields'
import { useCalculationEditing, useVariantModel, useVariantWord } from './use-calculations'
import VariantFields from './VariantFields'
import { addVariant, droppedVariantsBy, relabelVariant, removeVariant, variantLabel, variantModel, type DroppedVariant } from './variants'
import { droppedBy, sortKeys } from './calculations-edit'
import { allowedDimensions, DEFAULT_PERIOD, filterableDimensions, GRAINS, pickableMeasures, type Grain } from './editor'
import { ChartFields, QueryFields } from './EditorFields'
import { useAreaName } from './MeasurePicker'
import {
  comparing,
  comparingLastYear,
  fitted,
  panelArea,
  panelOffers,
  sourceChanged,
  withChoice,
  withComparing,
  withComparingLastYear,
  withDimensions,
  withFilter,
  withGrain,
  withMeasures,
  withPeriod,
  withSeries,
  withSettings,
  type PanelBlock,
} from './panel-edit'
import { paramLabel } from './params'
import { ownCategoryDimensions, seriesOf, seriesProblems } from './series'
import SeriesFields from './SeriesFields'
import { choiceOf } from './shape-rules'
import { viewTitleOf } from './ViewChart'

/**
 * The report designer's panel editor (spec 819 §E, ticket 829; the 798 prototype's `PanelEditor`), in the
 * inspector — never a modal. A report panel's view definition is inline, so the view editor's pieces (775's
 * `QueryFields` / `ChartFields`, 825's `SeriesFields`) edit it directly, each change one history step
 * (`./panel-edit` re-fits the chart to what is measured, so only the fitting types are ever offered):
 * - **provenance** for a panel copied from a saved view: "copied from … r n", and "the original has changed
 *   since you copied it" (the server's `sourceChangedSinceCopy`, or the source read now at a later revision);
 * - its title in English and Arabic (empty → generated from the model labels);
 * - the area, then its measures, breakdowns (the first is the axis), filters and period, and the chart type;
 * - up to 4 named series;
 * - the panel's own parameter list: each parameter bound or not, and why one cannot be.
 */
export default function ReportPanelEditor({
  block,
  def,
  model: baseModel,
  lang,
  onBlock,
  onBind,
}: {
  block: PanelBlock
  def: AnalyticsReportDefinition
  model: AnalyticsModel
  lang: string
  /** A change to this block; `key` makes typing in one field one step. */
  onBlock: (f: (b: PanelBlock) => PanelBlock, key?: string | null) => void
  /** Binds a parameter to this panel (`true`, or the dimension a members one filters), or unbinds it (`null`). */
  onBind: (param: string, target: string | true | null) => void
}) {
  const { t } = useTranslation('boards')
  const areaName = useAreaName()
  const view = block.definition
  // 863 (spec 3543 B): the model plus one measure per variant of the panel, so every picker offers a variant like a
  // measure; `baseModel` is the model's own (the area picker, and what a variant may filter).
  const variantWord = useVariantWord()
  const model = useVariantModel(baseModel, view.query.variants, lang)
  const [droppedVariants, setDroppedVariants] = useState<DroppedVariant[]>([])
  // 862: a calculation an edit takes out (its measure removed, compare off, …) is named in a note until dismissed.
  const calcs = view.query.calculations ?? []
  const calc = useCalculationEditing(model, lang, calcs)
  const setView = (f: (d: PanelBlock['definition']) => PanelBlock['definition']) => {
    const after = f(view)
    const lost = droppedBy(view, after, model)
    if (lost.length) calc.setDropped(lost)
    const lostVariants = droppedVariantsBy(view, after, model)
    if (lostVariants.length) setDroppedVariants(lostVariants)
    onBlock((b) => ({ ...b, definition: f(b.definition) }))
  }
  // A variant added or removed changes the measures: the chart is re-fitted over the model as it then is.
  const refit = (d: PanelBlock['definition']) => fitted(d, variantModel(baseModel, d.query.variants, lang, variantWord))
  const setTitle = (title: AnalyticsLabel, which: 'en' | 'ar') => onBlock((b) => ({ ...b, title }), `block:${block.id}:title:${which}`)

  const area = panelArea(view, model)
  const areas = model.areas.filter((a) => pickableMeasures(baseModel).some((m) => m.area === a.key))
  // Picking an area starts the panel on that area's first measure. 864 (spec 3543 decision 30): the measure picker then
  // lists every area, grouped, so a panel may add measures of up to four.
  const measures = view.query.measures
  const dimensions = view.query.dimensions
  const allowed = useMemo(() => allowedDimensions(measures, model), [measures, model])
  const offers = panelOffers(view, model)
  const choice = choiceOf(view.chart)
  const chosen = offers.find((o) => o.choice === choice)?.offered ? choice : null
  const grain: Grain = GRAINS.find((g) => g === view.query.grain) ?? 'day'
  const seriesDims = useMemo(() => {
    const own = ownCategoryDimensions(view, model)
    return filterableDimensions(allowed).filter((d) => own.has(d.key))
  }, [allowed, view, model])
  const problems = useMemo(() => seriesProblems(view, model), [view, model])
  const measureName = calc.measureName

  return (
    <div className="flex flex-col gap-4" data-designer-panel-editor={block.id}>
      {block.from && <Provenance block={block} model={model} lang={lang} />}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t('designer.panel.titleEn')} hint={t('designer.panel.titleHint')}>
          <Input value={block.title.en} dir="ltr" onChange={(e) => setTitle({ ...block.title, en: e.target.value }, 'en')} data-designer-panel-title="en" />
        </Field>
        <Field label={t('designer.panel.titleAr')}>
          <Input value={block.title.ar} dir="rtl" onChange={(e) => setTitle({ ...block.title, ar: e.target.value }, 'ar')} data-designer-panel-title="ar" />
        </Field>
      </div>

      <Field label={t('designer.panel.area')}>
        <Select
          value={area ?? ''}
          onChange={(e) => {
            const first = pickableMeasures(baseModel).find((m) => m.area === e.target.value)
            if (first) setView((d) => withMeasures(d, [first.key], model))
          }}
          data-designer-panel-area
        >
          {!area && <option value="">{t('designer.panel.areaPick')}</option>}
          {areas.map((a) => (
            <option key={a.key} value={a.key}>
              {areaName(a.key)}
            </option>
          ))}
        </Select>
      </Field>

      <QueryFields
        model={model}
        lang={lang}
        measures={measures}
        onMeasures={(next) => setView((d) => withMeasures(d, next, model))}
        dimensions={dimensions}
        onDimensions={(next) => setView((d) => withDimensions(d, next, model))}
        allowed={allowed}
        filters={view.query.filters}
        onFilter={(dimension, values) => setView((d) => withFilter(d, dimension, values))}
        period={view.query.period ?? DEFAULT_PERIOD}
        onPeriod={(period) => setView((d) => withPeriod(d, period))}
        invalid={{ measure: false, dimension: false }}
        grain={grain}
        onGrain={(g) => setView((d) => withGrain(d, g, model))}
      />

      <ChartFields
        offers={offers}
        chosen={chosen}
        onChoose={(c) => setView((d) => withChoice(d, c, model))}
        invalid={false}
        measures={measures}
        measureName={measureName}
        settings={view.chart}
        onSettings={(action) =>
          setView((d) => withSettings(d, (c) => (typeof action === 'function' ? (action as (c: AnalyticsChart) => AnalyticsChart)(c) : action), model))
        }
        compare={comparing(view)}
        onCompare={(on) => setView((d) => withComparing(d, on, model))}
        lastYear={comparingLastYear(view)}
        onLastYear={(on) => setView((d) => withComparingLastYear(d, on, model))}
        sortKeys={sortKeys(view)}
        sortLocked={calcs.some((c) => c.kind === 'cumulativeShare')}
        perParent={calc.perParent}
      />

      <VariantFields
        model={baseModel}
        lang={lang}
        definition={view}
        onAdd={(draft) => setView((d) => refit(addVariant(d, draft, baseModel)))}
        onRemove={(key) => setView((d) => refit(removeVariant(d, key, model)))}
        onRelabel={(key, l) => setView((d) => relabelVariant(d, key, l))}
        nameOf={(v) => variantLabel(v, baseModel, lang, variantWord)}
        dropped={droppedVariants}
        onDismissDropped={() => setDroppedVariants([])}
      />

      <CalculationFields
        model={model}
        lang={lang}
        selection={{ measures, dimensions, series: seriesOf(view).length, compare: comparing(view), lastYear: comparingLastYear(view), calculations: calcs }}
        {...calc.fields(setView)}
      />

      <SeriesFields
        series={seriesOf(view)}
        onSeries={(next) => setView((d) => withSeries(d, next, model))}
        dimensions={seriesDims}
        lang={lang}
        problems={problems}
      />

      <PanelParams block={block} def={def} model={model} lang={lang} onBind={onBind} />
    </div>
  )
}

/** "Copied from the view … r n" — and whether the original has changed since the copy. */
function Provenance({ block, model, lang }: { block: PanelBlock; model: AnalyticsModel; lang: string }) {
  const { t } = useTranslation('boards')
  const from = block.from!
  const source = useQuery({
    queryKey: analyticsItemKey(from.viewId),
    queryFn: () => analyticsApi.item(from.viewId),
    retry: false,
    staleTime: 60_000,
  })
  const changed = sourceChanged(block, source.data)
  const name = source.data ? viewTitleOf(source.data, model, lang, t) : from.viewId
  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-attention-border bg-attention-050 p-2 text-xs text-attention-800"
      data-designer-provenance={from.viewId}
      data-designer-source-changed={changed ? 'yes' : 'no'}
    >
      <p className="flex items-start gap-1.5">
        <Copy className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          {t('designer.panel.from', {
            view: fsi(name),
            revision: fsi(from.revision),
          })}
        </span>
      </p>
      {changed && (
        <p className="flex items-start gap-1.5 font-medium" data-designer-source-changed-note>
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('designer.panel.fromChanged')}
        </p>
      )}
      {source.isError && <p data-designer-source-gone>{t('designer.panel.fromGone')}</p>}
    </div>
  )
}

/** The panel's own parameter list: each bound or not; one that cannot bind says why; a binding that broke says so. */
function PanelParams({
  block,
  def,
  model,
  lang,
  onBind,
}: {
  block: PanelBlock
  def: AnalyticsReportDefinition
  model: AnalyticsModel
  lang: string
  onBind: (param: string, target: string | true | null) => void
}) {
  const { t } = useTranslation('boards')
  return (
    <fieldset className="flex flex-col gap-1.5 rounded-md border border-border/60 p-3" data-designer-panel-params>
      <legend className="px-1 text-xs font-medium text-muted-foreground">{t('designer.panel.params')}</legend>
      {def.params.length === 0 && <p className="text-xs text-muted-foreground">{t('designer.panel.noParams')}</p>}
      {def.params.map((p) => {
        const bound = def.bindings[p.name]?.[block.id]
        const c = canBind(p, block.definition, model, typeof bound === 'string' ? bound : undefined)
        const on = bound !== undefined
        const off = !on && !c.ok
        return (
          <div
            key={p.name}
            className="flex flex-wrap items-center gap-2"
            data-designer-panel-param={p.name}
            data-bound={on ? (c.ok ? 'yes' : 'broken') : c.ok ? 'no' : 'cannot'}
          >
            <Chip
              on={on}
              aria-disabled={off || undefined}
              onClick={() => (on ? onBind(p.name, null) : c.ok && onBind(p.name, c.target ?? true))}
              data-designer-panel-bind={p.name}
            >
              <bdi>{paramLabel(p, lang, t)}</bdi>
            </Chip>
            {!c.ok && <span className={`text-xs ${on ? 'text-danger-800' : 'text-muted-foreground'}`}>{t(`params.reason.${c.reason}`)}</span>}
          </div>
        )
      })}
    </fieldset>
  )
}
