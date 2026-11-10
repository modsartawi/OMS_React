import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Plus, Trash2, X } from 'lucide-react'
import { MAX_VARIANTS, type AnalyticsVariant } from '@/core/models/analytics-calculations'
import type { AnalyticsDimension, AnalyticsFilter, AnalyticsLabel, AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import MultiSelect from '@/core/ui/MultiSelect'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { labelOverride } from './calculations-edit'
import SearchFilterField from './SearchFilterField'
import { variantFilterDimensions, variantMeasures, variantProblem, type DroppedVariant, type VariantDraft } from './variants'
import { measureOf } from './wire'

/**
 * "Add filtered measure" in the query builder (ticket 863, BackOffice spec 3543 part B) — a thin renderer over
 * `./variants`, shared by the view editor and the report panel editor. A measure, its filters (on breakdowns the query
 * does not break down by) and an optional label in both languages or neither. A saved variant is listed with its name;
 * its label stays overridable and it can be removed. Its filters are fixed once added: to change them, remove it and
 * add another. A variant an edit took out is named in a note until dismissed.
 */
export default function VariantFields({
  model,
  lang,
  definition,
  onAdd,
  onRemove,
  onRelabel,
  nameOf,
  dropped,
  onDismissDropped,
}: {
  /** The model's own measures (never a variant of a variant). */
  model: AnalyticsModel
  lang: string
  /** The draft as it now is. */
  definition: AnalyticsViewDefinition
  onAdd: (draft: VariantDraft) => void
  onRemove: (key: string) => void
  onRelabel: (key: string, label: AnalyticsLabel | undefined) => void
  /** A variant's name in the screen's language: its label, else "{measure} ({filter values})". */
  nameOf: (variant: AnalyticsVariant) => string
  dropped: DroppedVariant[]
  onDismissDropped: () => void
}) {
  const { t } = useTranslation('boards')
  const measureName = (k: string) => saysIn(measureOf(model, k)?.label, lang) || k
  const measures = variantMeasures(definition, model)
  const [measure, setMeasure] = useState('')
  const shownMeasure = measures.includes(measure) ? measure : (measures[0] ?? '')
  const dims = variantFilterDimensions(shownMeasure, definition.query.dimensions, model)
  const [filters, setFilters] = useState<AnalyticsFilter[]>([])
  const [added, setAdded] = useState<string[]>([])
  const [typed, setTyped] = useState<AnalyticsLabel>({ en: '', ar: '' })
  const variants = definition.query.variants ?? []

  if (definition.query.measures.length === 0) return null
  const values = (key: string) => filters.find((f) => f.dimension === key)?.values ?? []
  const shownDims = dims.filter((d) => added.includes(d.key) || values(d.key).length > 0)
  const restDims = dims.filter((d) => !shownDims.includes(d))
  const label = labelOverride(typed)
  const draft: VariantDraft = {
    measure: shownMeasure,
    filters: filters.filter((f) => dims.some((d) => d.key === f.dimension)),
    ...(label.ok && label.label ? { label: label.label } : {}),
  }
  const problem = label.ok ? variantProblem(draft, definition, model) : 'oneLanguage'
  const setFilter = (dimension: string, next: string[]) => setFilters((fs) => [...fs.filter((f) => f.dimension !== dimension), ...(next.length ? [{ dimension, values: next }] : [])])
  const add = () => {
    if (problem) return
    onAdd(draft)
    setFilters([])
    setAdded([])
    setTyped({ en: '', ar: '' })
  }
  const dimLabel = (d: AnalyticsDimension) => saysIn(d.label, lang) || d.key

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-border/60 p-3" data-analytics-variants>
      <legend className="px-1 text-xs font-medium text-muted-foreground">{t('editor.variant.title')}</legend>
      <p className="text-xs text-muted-foreground">{t('editor.variant.hint', { max: MAX_VARIANTS })}</p>

      {dropped.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-attention-border bg-attention-050 p-2 text-xs text-attention-800" role="status" data-analytics-variant-dropped>
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <ul className="min-w-0 flex-1">
            {dropped.map((d) => (
              <li key={d.variant.key} data-analytics-variant-dropped-key={d.variant.key}>
                {t(`editor.variant.dropped.${d.reason}`, { variant: fsi(nameOf(d.variant)) })}
              </li>
            ))}
          </ul>
          <IconButton label={t('editor.calc.dismiss')} size="compact" onClick={onDismissDropped}>
            <X className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      )}

      {variants.map((v) => (
        <VariantRow key={v.key} variant={v} name={nameOf(v)} onRemove={() => onRemove(v.key)} onRelabel={(l) => onRelabel(v.key, l)} />
      ))}

      {variants.length < MAX_VARIANTS && measures.length > 0 && (
        <div className="flex flex-col gap-2" data-analytics-variant-add>
          <Field label={t('editor.variant.measure')}>
            <Select
              value={shownMeasure}
              onChange={(e) => {
                setMeasure(e.target.value)
                setFilters([])
                setAdded([])
              }}
              data-editor-variant-measure
            >
              {measures.map((k) => (
                <option key={k} value={k}>
                  {fsi(measureName(k))}
                </option>
              ))}
            </Select>
          </Field>
          {shownDims.map((d) =>
            d.values.length > 0 ? (
              <Field key={d.key} label={t('editor.variant.where', { dimension: fsi(dimLabel(d)) })}>
                <MultiSelect
                  label={t('editor.variant.where', { dimension: fsi(dimLabel(d)) })}
                  value={values(d.key)}
                  onChange={(v) => setFilter(d.key, v)}
                  options={d.values.map((v) => ({ value: v.key, text: saysIn(v.label, lang) || v.key }))}
                  data-testid={`editor-variant-filter-${d.key}`}
                />
              </Field>
            ) : (
              <SearchFilterField key={d.key} dimension={d} lang={lang} value={values(d.key)} onChange={(v) => setFilter(d.key, v)} />
            ),
          )}
          {restDims.length > 0 ? (
            <Field label={t('editor.variant.addFilter')}>
              <Select value="" onChange={(e) => e.target.value && setAdded((a) => [...a, e.target.value])} data-editor-variant-add-filter>
                <option value="">{t('editor.variant.addFilterPick')}</option>
                {restDims.map((d) => (
                  <option key={d.key} value={d.key}>
                    {fsi(dimLabel(d))}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            shownDims.length === 0 && <p className="text-xs text-muted-foreground">{t('editor.variant.noFilterable')}</p>
          )}
          <LabelFields typed={typed} onTyped={setTyped} />
          {problem && problem !== 'oneLanguage' && (
            <p className="text-xs text-muted-foreground" data-analytics-variant-why={problem}>
              {t(`editor.variant.why.${problem}`, { max: MAX_VARIANTS })}
            </p>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={add} disabled={!!problem} data-editor-variant-add>
              <Plus className="size-3.5" aria-hidden />
              {t('editor.variant.add')}
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  )
}

/** The label in both languages or neither (decision 5); one alone is flagged and never saved. */
function LabelFields({ typed, onTyped, placeholder }: { typed: AnalyticsLabel; onTyped: (l: AnalyticsLabel) => void; placeholder?: string }) {
  const { t } = useTranslation('boards')
  const checked = labelOverride(typed)
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('editor.calc.labelEn')} invalid={!checked.ok && !typed.en.trim()}>
          <Input value={typed.en} dir="ltr" placeholder={placeholder ? fsi(placeholder) : undefined} onChange={(e) => onTyped({ ...typed, en: e.target.value })} data-editor-variant-label="en" />
        </Field>
        <Field label={t('editor.calc.labelAr')} invalid={!checked.ok && !typed.ar.trim()}>
          <Input value={typed.ar} dir="rtl" onChange={(e) => onTyped({ ...typed, ar: e.target.value })} data-editor-variant-label="ar" />
        </Field>
      </div>
      <p className={`text-xs ${checked.ok ? 'text-muted-foreground' : 'text-danger-800'}`} data-analytics-variant-label-problem={checked.ok ? undefined : 'oneLanguage'}>
        {t(checked.ok ? 'editor.variant.labelHint' : 'editor.calc.labelOneLanguage')}
      </p>
    </>
  )
}

/** One saved variant: its name, its label overridable, and remove. */
function VariantRow({ variant: v, name, onRemove, onRelabel }: { variant: AnalyticsVariant; name: string; onRemove: () => void; onRelabel: (label: AnalyticsLabel | undefined) => void }) {
  const { t } = useTranslation('boards')
  const [typed, setTyped] = useState<AnalyticsLabel>(v.label ?? { en: '', ar: '' })
  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-2" data-analytics-variant={v.key}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          <bdi>{name}</bdi>
        </span>
        <IconButton label={t('editor.variant.remove', { variant: fsi(name) })} size="compact" onClick={onRemove} data-editor-variant-remove={v.key}>
          <Trash2 className="size-3.5" aria-hidden />
        </IconButton>
      </div>
      <LabelFields
        typed={typed}
        placeholder={name}
        onTyped={(next) => {
          setTyped(next)
          const r = labelOverride(next)
          if (r.ok) onRelabel(r.label)
        }}
      />
    </div>
  )
}
