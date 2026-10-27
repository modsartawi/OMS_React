import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  CATEGORY_GROUPS,
  COVERAGE_SEGMENTS,
  INVOICE_EFFECTS,
  LINE_EFFECTS,
  effectLevel,
  type CategoryEffect,
  type CategoryGroup,
  type CoverageEffect,
  type CoverageEffectKind,
  type CoverageRule,
} from '@/core/insurance-rules/coverage-model'
import Ltr from '@/core/ui/Ltr'
import { formatNumber } from '@/core/util/number-format'
import { PayerMark } from './parts'
import { coverageRuleProblems, newCoverageEffect, withOverridesPayer } from './ruleset-edit'
import { Field, NumberInput, Select } from '@/core/insurance-rules/controls'

// What a category or coverage rule does (oms 617, BackOffice 3145 / 3146 as built): a category rule sets ONE group
// (G1 Generic · G2 Brand · G3 NonMed); a coverage rule sets ONE value — a line's (covered, prior approval,
// deductible, price / quantity / days-supply cap) or the invoice's (segment, exception prescriptions) — applying
// where the payer said nothing, or overriding the payer when marked.

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
    <div className="inline-flex gap-1" role="radiogroup" aria-label={t('effect.setCategory')} data-category-pick="">
      {CATEGORY_GROUPS.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={effect.group === g}
          data-group-pick={g}
          onClick={() => effect.group !== g && onChange({ ...effect, group: g })}
          className={`h-7 rounded-full border px-3 text-xs font-medium ${effect.group === g ? 'border-primary bg-primary-050 text-primary-800' : 'border-border bg-card text-muted-foreground hover:bg-accent'}`}
        >
          {t(`group.${g}`)}
        </button>
      ))}
    </div>
  )
}

/** The one value a coverage rule sets: what, its value, and its payer mark; the rule's problems refused in words. */
export function CoverageEffectEditor({ rule, onChange }: { rule: Pick<CoverageRule, 'when' | 'then'>; onChange: (then: CoverageEffect[], coalesce?: string) => void }) {
  const { t } = useTranslation('insurance-coverage')
  const e = rule.then[0] as CoverageEffect | undefined
  const problems = coverageRuleProblems(rule)
  const pick = (kind: CoverageEffectKind) => {
    const next = newCoverageEffect(kind)
    onChange([e?.overridesPayer ? withOverridesPayer(next, true) : next])
  }
  return (
    <div className="flex flex-col gap-2" data-coverage-effect="">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-effect={e?.effect ?? ''}>
        <Field label={t('effect.sets')}>
          <Select value={e?.effect ?? ''} data-pick-effect="" className="w-56" onChange={(ev) => ev.target.value && pick(ev.target.value as CoverageEffectKind)}>
            {!e && <option value="">{t('effect.pick')}</option>}
            <optgroup label={t('effect.lineGroup')}>
              {LINE_EFFECTS.map((k) => (
                <option key={k} value={k}>
                  {t(`effect.${k}`)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('effect.invoiceGroup')}>
              {INVOICE_EFFECTS.map((k) => (
                <option key={k} value={k}>
                  {t(`effect.${k}`)}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>
        {e && (
          <>
            <EffectFields e={e} set={(x, c) => onChange([x, ...rule.then.slice(1)], c ? `effect:${c}` : undefined)} />
            <label className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={t('payerMark.overridesHint')}>
              <input type="checkbox" checked={!!e.overridesPayer} data-input="overridesPayer" onChange={(ev) => onChange([withOverridesPayer(e, ev.target.checked), ...rule.then.slice(1)])} />
              {t('effect.overridesPayer')}
            </label>
            <PayerMark effect={e} />
          </>
        )}
      </div>
      {e && (
        <p className="text-xs text-muted-foreground" data-effect-level={effectLevel(e.effect)}>
          {t(`effect.level.${effectLevel(e.effect)}`)}
        </p>
      )}
      {problems.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-danger-800" role="alert" data-rule-problems="">
          {problems.map((p) => (
            <li key={p} data-rule-problem={p}>
              {t(`ruleProblem.${p}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EffectFields({ e, set }: { e: CoverageEffect; set: (e: CoverageEffect, coalesce?: string) => void }) {
  const { t } = useTranslation('insurance-coverage')
  switch (e.effect) {
    case 'covered':
    case 'priorApproval':
    case 'exceptionPrescriptions':
      return (
        <Select value={e.value ? 'yes' : 'no'} aria-label={t(`effect.${e.effect}`)} data-input="value" onChange={(ev) => set({ ...e, value: ev.target.value === 'yes' })}>
          <option value="yes">{t(`effect.yes.${e.effect}`)}</option>
          <option value="no">{t(`effect.no.${e.effect}`)}</option>
        </Select>
      )
    case 'deductible': {
      const put = (k: 'percent' | 'max', n: number | null) => {
        const next = { ...e }
        if (n === null) delete next[k]
        else next[k] = n
        set(next, k)
      }
      return (
        <>
          <Field label={t('effect.percent')} unit={t('unit.percent')}>
            <NumberInput
              value={e.percent ?? null}
              nullable
              invalid={e.percent !== undefined && !(e.percent >= 0 && e.percent <= 100)}
              placeholder={t('effect.payerSays')}
              className="w-24"
              data-input="percent"
              onValue={(n) => put('percent', n)}
            />
          </Field>
          <Field label={t('effect.max')} unit={t('unit.sar')}>
            <NumberInput value={e.max ?? null} nullable placeholder={t('effect.noCap')} className="w-24" data-input="max" onValue={(n) => put('max', n)} />
          </Field>
        </>
      )
    }
    case 'priceCap':
    case 'quantityCap':
    case 'daysSupplyCap':
      return (
        <Field label={t('effect.max')} unit={t(`unit.${CAP_UNIT[e.effect]}`)}>
          <NumberInput value={e.value} data-input="value" onValue={(n) => set({ ...e, value: n }, 'value')} />
        </Field>
      )
    case 'segment':
      return (
        <Select value={e.value} aria-label={t('effect.segment')} data-input="value" onChange={(ev) => set({ ...e, value: ev.target.value as typeof e.value })}>
          {COVERAGE_SEGMENTS.map((s) => (
            <option key={s} value={s}>
              {t(`segment.${s}`)}
            </option>
          ))}
        </Select>
      )
  }
}

const CAP_UNIT = { priceCap: 'sar', quantityCap: 'units', daysSupplyCap: 'days' } as const

/** A percent as ONE string ("15%"), its sign inside the value, so the renderer isolates the whole (bidi.md). */
export const percentOf = (t: TFunction<'insurance-coverage'>, n: number): string => t('unit.percentOf', { n: formatNumber(n) })

/** One coverage value read as words, its numbers isolated, with its payer mark. */
export function CoverageEffectLine({ e }: { e: CoverageEffect }) {
  const { t } = useTranslation('insurance-coverage')
  // One sentence per effect, its values in named slots: a value and its unit are one string, isolated once.
  const slots = { v: <Ltr />, b: <strong /> }
  const say = (key: string, values: Record<string, string> = {}) => <Trans t={t} i18nKey={key} values={values} components={slots} />
  let what
  switch (e.effect) {
    case 'covered':
    case 'priorApproval':
    case 'exceptionPrescriptions':
      what = t(`reads.${e.effect}.${e.value ? 'yes' : 'no'}`)
      break
    case 'deductible': {
      const which = e.percent === undefined ? (e.max === undefined ? 'none' : 'max') : e.max === undefined ? 'percent' : 'both'
      what = say(`reads.deductible.${which}`, {
        ...(e.percent !== undefined ? { percent: percentOf(t, e.percent) } : {}),
        ...(e.max !== undefined ? { max: formatNumber(e.max) } : {}),
      })
      break
    }
    case 'priceCap':
    case 'quantityCap':
    case 'daysSupplyCap':
      what = say(`reads.${e.effect}`, { value: formatNumber(e.value) })
      break
    case 'segment':
      what = say('reads.segment', { segment: t(`segment.${e.value}`) })
      break
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-effect-line={e.effect}>
      <span>{what}</span>
      <PayerMark effect={e} />
    </span>
  )
}
