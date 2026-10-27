import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import {
  CATEGORY_GROUPS,
  COVERAGE_EFFECTS,
  COVERAGE_SEGMENTS,
  type CategoryEffect,
  type CategoryGroup,
  type CoverageEffect,
  type CoverageEffectKind,
} from '@/core/insurance-rules/coverage-model'
import Ltr from '@/core/ui/Ltr'
import { formatNumber } from '@/core/util/number-format'
import { Field, NumberInput, PayerMark, Select } from './parts'
import { newCoverageEffect } from './ruleset-edit'

// What a category or coverage rule does (oms 617): a category rule sets ONE group (G1 Generic · G2 Brand ·
// G3 NonMed); a coverage rule sets any of its values, each marked as filling the payer's gap or overriding
// the payer.

/** "Brand (G2)": the group's word and its code, the code isolated. */
export function GroupName({ group }: { group: CategoryGroup }) {
  const { t } = useTranslation('insurance-coverage')
  return (
    <span data-category-group={group}>
      <strong>{t(`group.${group}`)}</strong> <Ltr>{group}</Ltr>
    </span>
  )
}

export function CategoryEffectEditor({ effect, onChange }: { effect: CategoryEffect; onChange: (e: CategoryEffect) => void }) {
  const { t } = useTranslation('insurance-coverage')
  return (
    <div className="inline-flex rounded-md border border-border/60" role="radiogroup" aria-label={t('effect.setCategory')} data-category-pick="">
      {CATEGORY_GROUPS.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={effect.group === g}
          data-group-pick={g}
          onClick={() => effect.group !== g && onChange({ ...effect, group: g })}
          className={`h-7 px-3 text-xs ${effect.group === g ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
        >
          {t(`group.${g}`)}
        </button>
      ))}
    </div>
  )
}

export function CoverageEffectsEditor({ effects, onChange }: { effects: CoverageEffect[]; onChange: (e: CoverageEffect[], coalesce?: string) => void }) {
  const { t } = useTranslation('insurance-coverage')
  const set = (i: number, e: CoverageEffect, coalesce?: string) => onChange(effects.map((x, j) => (j === i ? e : x)), coalesce ? `effect:${i}:${coalesce}` : undefined)
  const unused = COVERAGE_EFFECTS.filter((k) => !effects.some((e) => e.effect === k))
  return (
    <div className="flex flex-col gap-2" data-coverage-effects="">
      {effects.length === 0 && <p className="text-xs text-muted-foreground" data-effects-empty="">{t('effect.none')}</p>}
      {effects.map((e, i) => (
        <div key={e.effect} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border/60 bg-card p-2" data-effect={e.effect}>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{t(`effect.${e.effect}`)}</span>
          <EffectFields e={e} set={(x, c) => set(i, x, c)} />
          <label className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={t('payerMark.overridesHint')}>
            <input type="checkbox" checked={e.overridesPayer} data-input="overridesPayer" onChange={(ev) => set(i, { ...e, overridesPayer: ev.target.checked })} />
            {t('effect.overridesPayer')}
          </label>
          <PayerMark effect={e} />
          <button
            type="button"
            aria-label={t('effect.remove')}
            title={t('effect.remove')}
            data-effect-remove={e.effect}
            onClick={() => onChange(effects.filter((_, j) => j !== i))}
            className="ms-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}
      {unused.length > 0 && (
        <Select
          value=""
          aria-label={t('effect.add')}
          data-add-effect=""
          className="w-64"
          onChange={(ev) => ev.target.value && onChange([...effects, newCoverageEffect(ev.target.value as CoverageEffectKind)])}
        >
          <option value="">{t('effect.add')}</option>
          {unused.map((k) => (
            <option key={k} value={k}>
              {t(`effect.${k}`)}
            </option>
          ))}
        </Select>
      )}
    </div>
  )
}

function EffectFields({ e, set }: { e: CoverageEffect; set: (e: CoverageEffect, coalesce?: string) => void }) {
  const { t } = useTranslation('insurance-coverage')
  switch (e.effect) {
    case 'covered':
      return (
        <Select value={e.covered ? 'yes' : 'no'} aria-label={t('effect.covered')} data-input="covered" onChange={(ev) => set({ ...e, covered: ev.target.value === 'yes' })}>
          <option value="yes">{t('effect.coveredYes')}</option>
          <option value="no">{t('effect.coveredNo')}</option>
        </Select>
      )
    case 'priorApproval':
      return (
        <Select value={e.required ? 'yes' : 'no'} aria-label={t('effect.priorApproval')} data-input="required" onChange={(ev) => set({ ...e, required: ev.target.value === 'yes' })}>
          <option value="yes">{t('effect.approvalYes')}</option>
          <option value="no">{t('effect.approvalNo')}</option>
        </Select>
      )
    case 'deductible':
      return (
        <>
          <Field label={t('effect.pct')} unit={t('unit.percent')}>
            <NumberInput value={e.pct} data-input="pct" onValue={(n) => set({ ...e, pct: n ?? 0 }, 'pct')} />
          </Field>
          <Field label={t('effect.max')} unit={t('unit.sar')}>
            <NumberInput value={e.max} nullable placeholder={t('effect.noCap')} className="w-24" data-input="max" onValue={(n) => set({ ...e, max: n }, 'max')} />
          </Field>
        </>
      )
    case 'priceCap':
      return (
        <Field label={t('effect.max')} unit={t('unit.sar')}>
          <NumberInput value={e.max} data-input="max" onValue={(n) => set({ ...e, max: n ?? 0 }, 'max')} />
        </Field>
      )
    case 'qtyCap':
      return (
        <>
          <Field label={t('effect.maxQuantity')} unit={t('unit.units')}>
            <NumberInput value={e.maxQuantity} nullable placeholder={t('effect.noCap')} className="w-24" data-input="maxQuantity" onValue={(n) => set({ ...e, maxQuantity: n }, 'q')} />
          </Field>
          <Field label={t('effect.maxDaysSupply')} unit={t('unit.days')}>
            <NumberInput value={e.maxDaysSupply} nullable placeholder={t('effect.noCap')} className="w-24" data-input="maxDaysSupply" onValue={(n) => set({ ...e, maxDaysSupply: n }, 'd')} />
          </Field>
        </>
      )
    case 'segment':
      return (
        <Select value={e.segment} aria-label={t('effect.segment')} data-input="segment" onChange={(ev) => set({ ...e, segment: ev.target.value as typeof e.segment })}>
          {COVERAGE_SEGMENTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      )
  }
}

/** One coverage value read as words, its numbers isolated, with its payer mark. */
export function CoverageEffectLine({ e }: { e: CoverageEffect }) {
  const { t } = useTranslation('insurance-coverage')
  const n = (v: number) => <Ltr>{formatNumber(v)}</Ltr>
  let what
  switch (e.effect) {
    case 'covered':
      what = t(e.covered ? 'reads.covered' : 'reads.notCovered')
      break
    case 'priorApproval':
      what = t(e.required ? 'reads.approval' : 'reads.noApproval')
      break
    case 'deductible':
      what = (
        <>
          {t('reads.deductible')} {n(e.pct)}
          {t('unit.percent')}
          {e.max === null ? (
            <> · {t('effect.noCap')}</>
          ) : (
            <>
              {' · '}
              {t('reads.capped')} {n(e.max)} {t('unit.sar')}
            </>
          )}
        </>
      )
      break
    case 'priceCap':
      what = (
        <>
          {t('reads.priceCap')} {n(e.max)} {t('unit.sar')}
        </>
      )
      break
    case 'qtyCap':
      what = (
        <>
          {t('reads.qtyCap')}
          {e.maxQuantity !== null && (
            <>
              {' '}
              {n(e.maxQuantity)} {t('unit.units')}
            </>
          )}
          {e.maxDaysSupply !== null && (
            <>
              {' '}
              {n(e.maxDaysSupply)} {t('unit.days')}
            </>
          )}
        </>
      )
      break
    case 'segment':
      what = (
        <>
          {t('reads.segment')} <Ltr>{e.segment}</Ltr>
        </>
      )
      break
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-effect-line={e.effect}>
      <span>{what}</span>
      <PayerMark effect={e} />
    </span>
  )
}
