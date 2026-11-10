import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Plus, Trash2, X } from 'lucide-react'
import { MAX_CALCULATIONS, type AnalyticsCalculation, type AnalyticsCalculationKind } from '@/core/models/analytics-calculations'
import type { AnalyticsLabel, AnalyticsModel } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import {
  calculationKinds,
  labelOverride,
  measuresFor,
  ofFor,
  type CalculationDraft,
  type CalculationSelection,
  type DroppedCalculation,
} from './calculations-edit'
import { measureOf } from './wire'

/**
 * "Add calculation" in the query builder (ticket 862, spec 3519 decisions 23–24) — a thin renderer over
 * `./calculations-edit`, shared by the view editor (and so a board's "build a new view") and the report panel editor.
 * It offers only what the server's rules allow (a kind that does not fit is listed disabled, with why); each saved
 * calculation's measure, `of`, `until` and label stay editable, and it can be removed. A calculation an edit took out
 * is named in a note until dismissed.
 */
export default function CalculationFields({
  model,
  lang,
  selection,
  onAdd,
  onUpdate,
  onRemove,
  dropped,
  onDismissDropped,
  nameOf,
}: {
  model: AnalyticsModel
  lang: string
  selection: CalculationSelection
  onAdd: (draft: CalculationDraft) => void
  onUpdate: (key: string, draft: CalculationDraft) => void
  onRemove: (key: string) => void
  dropped: DroppedCalculation[]
  onDismissDropped: () => void
  /** A calculation's name in the screen's language: its label, else the derived default. */
  nameOf: (calculation: AnalyticsCalculation) => string
}) {
  const { t } = useTranslation('boards')
  const measureName = (k: string) => saysIn(measureOf(model, k)?.label, lang) || k
  const kinds = calculationKinds(selection, model)
  const [kind, setKind] = useState<AnalyticsCalculationKind | ''>('')
  const offered = kinds.find((k) => k.kind === kind)?.offered === true
  const pickedKind = offered ? (kind as AnalyticsCalculationKind) : null
  const choices = pickedKind ? measuresFor(pickedKind, selection.measures, model) : []
  const [measure, setMeasure] = useState('')
  const shownMeasure = choices.includes(measure) ? measure : (choices[0] ?? '')
  const ofs = pickedKind === 'ratio' ? ofFor(shownMeasure, selection.measures, model) : []
  const [of, setOf] = useState('')
  const shownOf = ofs.includes(of) ? of : (ofs[0] ?? '')
  const [until, setUntil] = useState<number | null>(null)

  if (selection.measures.length === 0) return null
  const add = () => {
    if (!pickedKind || !shownMeasure || (pickedKind === 'ratio' && !shownOf)) return
    onAdd({ kind: pickedKind, measure: shownMeasure, ...(pickedKind === 'ratio' ? { of: shownOf } : {}), ...(pickedKind === 'cumulativeShare' && until ? { until } : {}) })
    setKind('')
    setUntil(null)
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-border/60 p-3" data-analytics-calculations>
      <legend className="px-1 text-xs font-medium text-muted-foreground">{t('editor.calc.title')}</legend>
      <p className="text-xs text-muted-foreground">{t('editor.calc.hint', { max: MAX_CALCULATIONS })}</p>

      {dropped.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-attention-border bg-attention-050 p-2 text-xs text-attention-800" role="status" data-analytics-calc-dropped>
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <ul className="min-w-0 flex-1">
            {dropped.map((d) => (
              <li key={d.calculation.key} data-analytics-calc-dropped-key={d.calculation.key}>
                {t(`editor.calc.dropped.${d.reason}`, { calculation: fsi(nameOf(d.calculation)) })}
              </li>
            ))}
          </ul>
          <IconButton label={t('editor.calc.dismiss')} size="compact" onClick={onDismissDropped}>
            <X className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      )}

      {selection.calculations.map((c) => (
        <CalculationRow
          key={c.key}
          calculation={c}
          model={model}
          selection={selection}
          measureName={measureName}
          name={nameOf(c)}
          onUpdate={(draft) => onUpdate(c.key, draft)}
          onRemove={() => onRemove(c.key)}
        />
      ))}

      <div className="flex flex-col gap-2" data-analytics-calc-add>
        <Field label={t('editor.calc.kind')}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as AnalyticsCalculationKind | '')} data-editor-calc-kind>
            <option value="">{t('editor.calc.kindPick')}</option>
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind} disabled={!k.offered} title={k.offered ? undefined : t(`editor.calc.why.${k.reason}`)} data-offered={k.offered ? 'yes' : 'no'}>
                {t(`editor.calc.kindName.${k.kind}`)}
              </option>
            ))}
          </Select>
        </Field>
        {kinds.some((k) => !k.offered) && (
          <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground" data-analytics-calc-why-not>
            {kinds.map((k) =>
              k.offered ? null : (
                <li key={k.kind} data-analytics-calc-why={k.kind}>
                  <span className="font-medium text-foreground">{t(`editor.calc.kindName.${k.kind}`)}</span> {t(`editor.calc.why.${k.reason}`)}
                </li>
              ),
            )}
          </ul>
        )}
        {pickedKind && (
          <>
            <Field label={t('editor.calc.measure')}>
              <Select value={shownMeasure} onChange={(e) => setMeasure(e.target.value)} data-editor-calc-measure>
                {choices.map((k) => (
                  <option key={k} value={k}>
                    {fsi(measureName(k))}
                  </option>
                ))}
              </Select>
            </Field>
            {pickedKind === 'ratio' && (
              <Field label={t('editor.calc.of')}>
                <Select value={shownOf} onChange={(e) => setOf(e.target.value)} data-editor-calc-of>
                  {ofs.map((k) => (
                    <option key={k} value={k}>
                      {fsi(measureName(k))}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {pickedKind === 'cumulativeShare' && <UntilField value={until} onChange={setUntil} />}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={add} data-editor-calc-add>
                <Plus className="size-3.5" aria-hidden />
                {t('editor.calc.add')}
              </Button>
            </div>
          </>
        )}
      </div>
    </fieldset>
  )
}

/** `until` (1–100), optional: empty keeps every row. */
function UntilField({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const { t } = useTranslation('boards')
  return (
    <Field label={t('editor.calc.until')}>
      <Input
        type="number"
        min={1}
        max={100}
        inputMode="numeric"
        dir="ltr"
        value={value ?? ''}
        placeholder={t('editor.calc.untilPlaceholder')}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10)
          onChange(Number.isFinite(n) && n > 0 ? Math.min(100, n) : null)
        }}
        data-editor-calc-until
      />
    </Field>
  )
}

/** One saved calculation: its measure, `of` and `until` editable, its label overridable (both languages or neither). */
function CalculationRow({
  calculation: c,
  model,
  selection,
  measureName,
  name,
  onUpdate,
  onRemove,
}: {
  calculation: AnalyticsCalculation
  model: AnalyticsModel
  selection: CalculationSelection
  measureName: (k: string) => string
  name: string
  onUpdate: (draft: CalculationDraft) => void
  onRemove: () => void
}) {
  const { t } = useTranslation('boards')
  const { key: _key, ...draft } = c
  void _key
  const [typed, setTyped] = useState<AnalyticsLabel>(c.label ?? { en: '', ar: '' })
  const checked = labelOverride(typed)
  const setLabel = (next: AnalyticsLabel) => {
    setTyped(next)
    const r = labelOverride(next)
    if (r.ok) {
      const { label: _l, ...rest } = draft
      void _l
      onUpdate(r.label ? { ...rest, label: r.label } : rest)
    }
  }
  const choices = measuresFor(c.kind, selection.measures, model)
  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-2" data-analytics-calc={c.key} data-analytics-calc-kind={c.kind}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          <bdi>{name}</bdi>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{t(`editor.calc.kindName.${c.kind}`)}</span>
        <IconButton label={t('editor.calc.remove', { calculation: fsi(name) })} size="compact" onClick={onRemove} data-editor-calc-remove={c.key}>
          <Trash2 className="size-3.5" aria-hidden />
        </IconButton>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('editor.calc.measure')}>
          <Select
            value={c.measure}
            onChange={(e) => {
              const measure = e.target.value
              const of = c.kind === 'ratio' ? ofFor(measure, selection.measures, model)[0] : undefined
              onUpdate({ ...draft, measure, ...(of ? { of } : {}) })
            }}
          >
            {choices.map((k) => (
              <option key={k} value={k}>
                {fsi(measureName(k))}
              </option>
            ))}
          </Select>
        </Field>
        {c.kind === 'ratio' && (
          <Field label={t('editor.calc.of')}>
            <Select value={c.of ?? ''} onChange={(e) => onUpdate({ ...draft, of: e.target.value })}>
              {ofFor(c.measure, selection.measures, model).map((k) => (
                <option key={k} value={k}>
                  {fsi(measureName(k))}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {c.kind === 'cumulativeShare' && (
          <UntilField
            value={c.until ?? null}
            onChange={(n) => {
              const { until: _u, ...rest } = draft
              void _u
              onUpdate(n ? { ...rest, until: n } : rest)
            }}
          />
        )}
        <Field label={t('editor.calc.labelEn')} invalid={!checked.ok && !typed.en.trim()}>
          <Input value={typed.en} dir="ltr" placeholder={fsi(name)} onChange={(e) => setLabel({ ...typed, en: e.target.value })} data-editor-calc-label="en" />
        </Field>
        <Field label={t('editor.calc.labelAr')} invalid={!checked.ok && !typed.ar.trim()}>
          <Input value={typed.ar} dir="rtl" onChange={(e) => setLabel({ ...typed, ar: e.target.value })} data-editor-calc-label="ar" />
        </Field>
      </div>
      <p className={`text-xs ${checked.ok ? 'text-muted-foreground' : 'text-danger-800'}`} data-analytics-calc-label-problem={checked.ok ? undefined : 'oneLanguage'}>
        {t(checked.ok ? 'editor.calc.labelHint' : 'editor.calc.labelOneLanguage')}
      </p>
    </div>
  )
}
