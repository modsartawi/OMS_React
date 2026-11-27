import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Save } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { WeightSetListItem, WeightSetVersionRef } from '@/core/models/sourcing-run'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { formatMoney3 } from '@/core/util/number-format'
import { simulatorApi } from './api'
import { controlValue, isChanged, saveRequest, WEIGHT_CONTROLS, WEIGHT_GROUPS, type WeightControl, type WeightDraft } from './draft-model'
import Toggle from './Toggle'

const refKey = (r: WeightSetVersionRef) => JSON.stringify([r.name, r.version])

/**
 * The weight set (ticket 963, spec 4354 §10 and §19; the prototype's `cWeights`, without its switch for pricing waiting
 * on each shipment — spec 4354 Further Notes). A picker of the named sets and their versions, a "changed, not saved"
 * mark, "Save as a named set" (under the save grant), then Weights (sliders), Factors and Reach and shape (switches),
 * among them one fee per order. Changes make a draft that goes to the door in full on the next Run.
 */
export default function WeightSetPanel({
  sets,
  setsFailed,
  chosen,
  onChoose,
  draft,
  reading,
  onChange,
  canSave,
  onSaved,
}: {
  sets: readonly WeightSetListItem[] | undefined
  setsFailed: boolean
  chosen: WeightSetVersionRef | null
  onChoose: (ref: WeightSetVersionRef) => void
  draft: WeightDraft | null
  reading: boolean
  onChange: (key: string, value: number | boolean) => void
  canSave: boolean
  onSaved: (ref: WeightSetVersionRef) => void
}) {
  const { t } = useTranslation('sourcing-simulator')
  const changed = !!draft && isChanged(draft)
  const options = (sets ?? []).filter((s) => !s.retired).flatMap((s) => s.versions.map((v) => ({ name: s.name, version: v.version, candidate: v.candidate, trial: v.trial })))

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-sim-weights="">
      <h2 className="text-sm font-semibold">{t('weights.title')}</h2>
      {setsFailed ? (
        <p className="text-xs text-muted-foreground" data-weights-unread="">
          {t('weights.unread')}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="min-w-0 flex-1"
            aria-label={t('weights.picker')}
            value={chosen ? refKey(chosen) : ''}
            disabled={!sets}
            onChange={(e) => {
              const [name, version] = JSON.parse(e.target.value) as [string, number]
              onChoose({ name, version })
            }}
            data-weights-picker=""
          >
            {!sets && <option value="">{t('weights.reading')}</option>}
            {options.map((o) => (
              <option key={refKey(o)} value={refKey(o)}>
                {t(o.candidate ? 'weights.optionCandidate' : o.trial ? 'weights.optionTrial' : 'weights.option', { name: fsi(o.name), version: fsi(o.version) })}
              </option>
            ))}
          </Select>
          {changed && (
            <span className="rounded-full border border-attention-border bg-attention-050 px-2 py-px text-[11px] text-attention-800" data-weights-changed="">
              {t('weights.changed')}
            </span>
          )}
          {reading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label={t('weights.reading')} />}
        </div>
      )}

      {draft?.base.trial && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-weights-trial="">
          {t('weights.trial')}
        </p>
      )}

      {draft && <SaveAs draft={draft} changed={changed} canSave={canSave} onSaved={onSaved} />}

      {draft &&
        WEIGHT_GROUPS.map((g) => (
          <div key={g} className="flex flex-col gap-2" data-weights-group={g}>
            <h3 className="text-xs font-semibold text-muted-foreground">{t(`weights.groups.${g}`)}</h3>
            {WEIGHT_CONTROLS.filter((c) => c.group === g).map((c) =>
              c.kind === 'slider' ? (
                <Slider key={c.key} control={c} value={controlValue(draft.values, c) as number} onChange={(v) => onChange(c.key, v)} />
              ) : (
                <Toggle
                  key={c.key}
                  checked={controlValue(draft.values, c) as boolean}
                  onChange={(on) => onChange(c.key, on)}
                  label={t(`weights.controls.${c.key}.label`)}
                  hint={t(`weights.controls.${c.key}.hint`, { defaultValue: '' }) || undefined}
                  data-weights-control={c.key}
                />
              ),
            )}
          </div>
        ))}
    </section>
  )
}

function Slider({ control, value, onChange }: { control: Extract<WeightControl, { kind: 'slider' }>; value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation('sourcing-simulator')
  const id = useId()
  const shown = control.riyals ? t('money', { amount: formatMoney3(value) }) : String(value)
  return (
    <div className="flex flex-col gap-0.5 text-xs" data-weights-control={control.key}>
      <label htmlFor={id} className="flex items-center justify-between gap-2">
        <span>{t(`weights.controls.${control.key}.label`)}</span>
        <span className="font-medium tabular-nums" data-weights-value="">
          <Ltr>{shown}</Ltr>
        </span>
      </label>
      <input
        id={id}
        type="range"
        dir="ltr"
        className="w-full accent-primary"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function SaveAs({ draft, changed, canSave, onSaved }: { draft: WeightDraft; changed: boolean; canSave: boolean; onSaved: (ref: WeightSetVersionRef) => void }) {
  const { t } = useTranslation('sourcing-simulator')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const save = useMutation({
    mutationFn: () => simulatorApi.saveWeightSet(saveRequest(draft, name)!),
    onSuccess: (ref) => {
      setOpen(false)
      setName('')
      onSaved(ref)
    },
  })
  if (!canSave)
    return (
      <p className="text-xs text-muted-foreground" data-weights-no-grant="">
        {t('weights.saveNeedsGrant')}
      </p>
    )
  if (!open)
    return (
      <Button variant="secondary" className="self-start" disabled={!changed} onClick={() => setOpen(true)} data-weights-save-open="">
        {t('weights.saveAs')}
      </Button>
    )
  const body = saveRequest(draft, name)
  return (
    <div className="flex flex-col gap-2" data-weights-save="">
      <Field label={t('weights.saveName')} hint={t('weights.saveHint', { name: fsi(draft.base.name), version: fsi(draft.base.version) })}>
        <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} data-weights-save-name="" />
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" disabled={!body || save.isPending} onClick={() => save.mutate()} data-weights-save-confirm="">
          {save.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
          {t('weights.save')}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} data-weights-save-cancel="">
          {t('weights.cancel')}
        </Button>
      </div>
      {save.isError && <ErrorBanner className="px-3 py-2" title={t('weights.saveFailed')} message={apiErrorMessage(save.error, t('weights.saveFailed'))} />}
    </div>
  )
}
