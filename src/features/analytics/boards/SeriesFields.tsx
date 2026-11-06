import { useTranslation } from 'react-i18next'
import { Plus, Trash2, X } from 'lucide-react'
import { slotColour } from '@/core/charts/slots'
import type { AnalyticsDimension, AnalyticsSeries } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import MultiSelect from '@/core/ui/MultiSelect'
import Select from '@/core/ui/Select'
import { formatCount, fsi } from '@/core/util/bidi'
import SearchFilterField from './SearchFilterField'
import { MAX_SERIES, nextSeriesId, type SeriesProblem } from './series'

/**
 * The view editor's named series (spec 819 §C, 799; ticket 825) — a thin renderer: up to {@link MAX_SERIES}
 * series, each with a name in English and Arabic and its own filters on the view's own category
 * breakdowns (`dimensions`). The swatch is the series' slot colour (its position). The editor owns the list;
 * `problems` are the save checks (the web's mirror, or the server's `ANALYTICS-411` list), each on its series.
 */
export default function SeriesFields({
  series,
  onSeries,
  dimensions,
  lang,
  problems,
}: {
  series: AnalyticsSeries[]
  onSeries: (next: AnalyticsSeries[]) => void
  /** The view's own category breakdowns a series may filter on. */
  dimensions: AnalyticsDimension[]
  lang: string
  problems: SeriesProblem[]
}) {
  const { t } = useTranslation('boards')
  const full = series.length >= MAX_SERIES
  const dimLabel = (key: string) => saysIn(dimensions.find((d) => d.key === key)?.label, lang) || key
  const nameOf = (s: AnalyticsSeries, i: number) => saysIn(s.label, lang) || s.label.en || s.label.ar || t('editor.series.unnamed', { n: fsi(i + 1) })
  const set = (id: string, patch: (s: AnalyticsSeries) => AnalyticsSeries) => onSeries(series.map((s) => (s.id === id ? patch(s) : s)))
  const firstDim = dimensions[0]?.key ?? ''
  const problemWords = (p: SeriesProblem) => {
    if (p.why === 'tooMany') return t('editor.series.problem.tooMany')
    const i = series.findIndex((s) => s.id === p.series)
    const name = fsi(i >= 0 ? nameOf(series[i], i) : p.series)
    return p.why === 'duplicate'
      ? t('editor.series.problem.duplicate', { series: name })
      : t('editor.series.problem.foreignDimension', { series: name, dimension: fsi(dimLabel(p.dimension)) })
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 rounded-md border border-border/60 p-3" data-editor-series={series.length}>
      <legend className="px-1 text-xs font-medium text-muted-foreground">{t('editor.series.title')}</legend>
      <p className="text-xs text-muted-foreground">{t('editor.series.hint')}</p>

      {series.map((s, i) => {
        const own = problems.some((p) => p.why !== 'tooMany' && p.series === s.id)
        return (
          <div key={s.id} className="flex flex-col gap-2 rounded-md bg-muted/40 p-2" data-editor-series-row={s.id} data-slot={i} aria-invalid={own || undefined}>
            <div className="flex items-end gap-2">
              <span className="mb-2 size-3 shrink-0 rounded-sm" style={{ background: slotColour(i) }} data-editor-series-swatch aria-hidden />
              <Field label={t('editor.series.labelEn')} className="min-w-0 flex-1" invalid={own}>
                <Input value={s.label.en} dir="ltr" onChange={(e) => set(s.id, (x) => ({ ...x, label: { ...x.label, en: e.target.value } }))} data-editor-series-label="en" />
              </Field>
              <Field label={t('editor.series.labelAr')} className="min-w-0 flex-1" invalid={own}>
                <Input value={s.label.ar} dir="rtl" onChange={(e) => set(s.id, (x) => ({ ...x, label: { ...x.label, ar: e.target.value } }))} data-editor-series-label="ar" />
              </Field>
              <IconButton
                label={t('editor.series.remove', { series: fsi(nameOf(s, i)) })}
                variant="danger"
                onClick={() => onSeries(series.filter((x) => x.id !== s.id))}
                data-editor-series-remove={s.id}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </IconButton>
            </div>
            {s.filters.map((f, fi) => {
              const dim = dimensions.find((d) => d.key === f.dimension)
              const setValues = (values: string[]) => set(s.id, (x) => ({ ...x, filters: x.filters.map((y, yi) => (yi === fi ? { ...y, values } : y)) }))
              return (
                <div key={fi} className="flex flex-wrap items-end gap-2 ps-5" data-editor-series-filter={`${s.id}:${fi}`}>
                  <Field label={t('editor.series.where')} className="w-40">
                    <Select
                      value={f.dimension}
                      onChange={(e) => set(s.id, (x) => ({ ...x, filters: x.filters.map((y, yi) => (yi === fi ? { dimension: e.target.value, values: [] } : y)) }))}
                      data-editor-series-dimension={`${s.id}:${fi}`}
                    >
                      {!dim && <option value={f.dimension}>{f.dimension}</option>}
                      {dimensions.map((d) => (
                        <option key={d.key} value={d.key}>
                          {saysIn(d.label, lang) || d.key}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="min-w-0 flex-1">
                    {dim && dim.values.length === 0 ? (
                      <SearchFilterField dimension={dim} lang={lang} value={f.values} onChange={setValues} />
                    ) : (
                      <Field label={t('editor.series.is')}>
                        <MultiSelect
                          label={t('editor.series.is')}
                          value={f.values}
                          onChange={setValues}
                          options={(dim?.values ?? []).map((v) => ({ value: v.key, text: saysIn(v.label, lang) || v.key }))}
                          data-testid={`editor-series-values-${s.id}-${fi}`}
                        />
                      </Field>
                    )}
                  </div>
                  <IconButton label={t('editor.series.removeFilter')} onClick={() => set(s.id, (x) => ({ ...x, filters: x.filters.filter((_, yi) => yi !== fi) }))}>
                    <X className="size-3.5" aria-hidden />
                  </IconButton>
                </div>
              )
            })}
            {firstDim && (
              <div className="ps-5">
                <Button
                  variant="text"
                  onClick={() => set(s.id, (x) => ({ ...x, filters: [...x.filters, { dimension: firstDim, values: [] }] }))}
                  data-editor-series-add-filter={s.id}
                >
                  <Plus className="size-3.5" aria-hidden />
                  {t('editor.series.addFilter')}
                </Button>
              </div>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outlined"
          disabled={full}
          onClick={() => !full && onSeries([...series, { id: nextSeriesId(series), label: { en: '', ar: '' }, filters: firstDim ? [{ dimension: firstDim, values: [] }] : [] }])}
          data-editor-add-series
        >
          <Plus className="size-3.5" aria-hidden />
          {t('editor.series.add', { n: fsi(formatCount(series.length, MAX_SERIES)) })}
        </Button>
        {full && (
          <span className="text-xs text-muted-foreground" data-editor-series-max>
            {t('editor.series.max')}
          </span>
        )}
      </div>

      {problems.length > 0 && (
        <div className="rounded-md border border-danger-border bg-danger-050 p-2 text-xs text-danger-800" role="alert" data-editor-series-problems={problems.length}>
          <p className="font-medium">{t('editor.series.problem.title')}</p>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 ps-4">
            {problems.map((p, i) => (
              <li key={i} data-editor-series-problem={p.why}>
                {problemWords(p)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </fieldset>
  )
}
