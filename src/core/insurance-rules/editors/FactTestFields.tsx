import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { CodeInput, CodesInput, Field, NumberInput, Select } from '@/core/insurance-rules/controls'
import {
  amountProblem,
  currencyProblem,
  operatorsFor,
  quantityProblem,
  unitProblem,
  withOp,
  type FactShape,
  type ValueProblem,
} from '@/core/insurance-rules/fact-tests'
import { FACT_DATE_OPS, isFactMoney, isFactQuantity, type FactCondition, type FactOp, type GuardCondition } from '@/core/insurance-rules/model'
import { codeSystemCodesQuery } from '@/core/insurance-rules/registry-api'
import { saysIn } from '@/core/rules/sentence'
import Input from '@/core/ui/Input'
import { formatPair, fsi } from '@/core/util/bidi'

// A fact condition's operator and value (oms 693): only what the fact's type and cardinality allow (`../fact-tests`).

type SetFact = (fn: (x: FactCondition) => GuardCondition, field?: string) => void

/**
 * A value typed as text and refused at the field: what it refuses stays on screen with its reason and never reaches the
 * condition, and leaving the box puts back the last value it took.
 */
function CheckedInput({
  value,
  problem,
  onValue,
  normalize = (s) => s,
  label,
  hook,
  className = 'w-24',
  invalid,
}: {
  value: string
  problem: (s: string) => ValueProblem | null
  onValue: (s: string) => void
  normalize?: (s: string) => string
  label: string
  hook: string
  className?: string
  invalid?: boolean
}) {
  const { t } = useTranslation('insurance-guards')
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const wrong = problem(text)
  return (
    <Field label={label}>
      <CodeInput
        value={text}
        invalid={invalid || wrong !== null}
        inputMode={hook === 'amount' || hook === 'quantity' ? 'decimal' : undefined}
        className={className}
        data-input={hook}
        onValue={(raw) => {
          const s = normalize(raw)
          setText(s)
          if (!problem(s) && s !== value) onValue(s)
        }}
        onBlur={() => setText(value)}
      />
      {wrong && (
        <span className="text-danger-800" role="alert" data-value-problem={wrong}>
          {t(`editor.factTest.problem.${wrong}`)}
        </span>
      )}
    </Field>
  )
}

/** The codes of a code fact, offered from its declared system; a code the list does not hold is typed and still matches (F12). */
function CodeFields({ c, shape, bad, set }: { c: FactCondition; shape: FactShape; bad: boolean; set: SetFact }) {
  const { t, i18n } = useTranslation('insurance-guards')
  const system = c.system ?? shape.system ?? ''
  const declared = shape.system !== null && system === shape.system
  const offered = useQuery({ ...codeSystemCodesQuery(system), enabled: declared }).data ?? []
  const codes = Array.isArray(c.value) ? c.value : []
  const left = declared ? offered.filter((o) => !codes.includes(o.code)) : []
  return (
    <>
      <Field label={t('editor.factTest.system')}>
        <CodeInput
          value={c.system ?? ''}
          placeholder={shape.system ? fsi(shape.system) : undefined}
          className="w-72"
          data-input="system"
          onValue={(s) =>
            set((x) => {
              const { system: _drop, ...rest } = x
              void _drop
              return s.trim() ? { ...rest, system: s.trim() } : rest
            }, 'system')
          }
        />
      </Field>
      <Field label={t('editor.field.codes')}>
        <CodesInput value={codes} invalid={bad} title={t('editor.codesHint')} data-input="codes" onCodes={(next) => set((x) => ({ ...x, value: next }), 'value')} />
      </Field>
      {left.length > 0 && (
        <Select
          value=""
          aria-label={t('editor.factTest.addCode')}
          className="w-56"
          data-input="addCode"
          onChange={(e) => {
            const code = e.target.value
            if (code) set((x) => ({ ...x, value: [...(Array.isArray(x.value) ? x.value : []), code] }))
          }}
        >
          <option value="">{t('editor.factTest.addCode')}</option>
          {left.map((o) => (
            <option key={o.code} value={o.code}>
              {fsi(formatPair(o.code, saysIn(o.label, i18n.language)))}
            </option>
          ))}
        </Select>
      )}
    </>
  )
}

function ValueFields({ c, shape, bad, set, numberUnit }: { c: FactCondition; shape: FactShape; bad: boolean; set: SetFact; numberUnit?: string }) {
  const { t } = useTranslation('insurance-guards')
  const v = c.value
  if (isFactMoney(v))
    return (
      <>
        <CheckedInput label={t('editor.factTest.amount')} hook="amount" value={v.amount} problem={amountProblem} invalid={bad} onValue={(amount) => set((x) => ({ ...x, value: { ...v, amount } }), 'value')} />
        <CheckedInput
          label={t('editor.factTest.currency')}
          hook="currency"
          className="w-16"
          value={v.currency}
          problem={currencyProblem}
          normalize={(s) => s.toUpperCase()}
          onValue={(currency) => set((x) => ({ ...x, value: { ...v, currency } }), 'value')}
        />
      </>
    )
  if (isFactQuantity(v))
    return (
      <>
        <CheckedInput label={t('editor.factTest.quantity')} hook="quantity" value={v.value} problem={quantityProblem} invalid={bad} onValue={(value) => set((x) => ({ ...x, value: { ...v, value } }), 'value')} />
        <CheckedInput label={t('editor.factTest.unit')} hook="unit" className="w-16" value={v.unit} problem={unitProblem} onValue={(unit) => set((x) => ({ ...x, value: { ...v, unit } }), 'value')} />
      </>
    )
  if (c.op === 'countAtLeast' || c.op === 'countBelow')
    return (
      <Field label={t('editor.factTest.count')}>
        <NumberInput value={Number(v)} min={0} invalid={bad} data-input="count" onValue={(n) => set((x) => ({ ...x, value: n }), 'value')} />
      </Field>
    )
  if (c.op === 'is')
    return (
      <Field label={t('editor.factTest.flag')}>
        <Select value={v === false ? 'no' : 'yes'} invalid={bad} data-input="flag" onChange={(e) => set((x) => ({ ...x, value: e.target.value === 'yes' }))}>
          <option value="yes">{t('editor.factTest.yes')}</option>
          <option value="no">{t('editor.factTest.no')}</option>
        </Select>
      </Field>
    )
  if ((FACT_DATE_OPS as readonly string[]).includes(c.op))
    return (
      <Field label={t('editor.factTest.day')}>
        <Input type="date" dir="ltr" value={String(v)} aria-invalid={bad || undefined} data-input="day" onChange={(e) => set((x) => ({ ...x, value: e.target.value }), 'value')} />
      </Field>
    )
  if (c.op === 'anyOf' || c.op === 'noneOf') {
    if (shape.type === 'code') return <CodeFields c={c} shape={shape} bad={bad} set={set} />
    return (
      <Field label={t('editor.field.codes')}>
        <CodesInput
          value={Array.isArray(v) ? v : [String(v)]}
          invalid={bad}
          title={t('editor.codesHint')}
          placeholder={fsi(t('editor.factTest.codesPlaceholder'))}
          data-input="codes"
          onCodes={(codes) => set((x) => ({ ...x, value: codes }), 'value')}
        />
      </Field>
    )
  }
  return (
    <Field label={t('editor.field.value')} unit={numberUnit}>
      <NumberInput value={Number(v)} invalid={bad} data-input="value" onValue={(n) => set((x) => ({ ...x, value: n }), 'value')} />
    </Field>
  )
}

/**
 * The operator and value of a fact block. An operator its fact cannot answer is only ever on a rule saved before: it stays
 * selected so the rule opens as written, and says so.
 */
export function FactTestFields({ c, shape, bad, set, numberUnit, unknownOn }: { c: FactCondition; shape: FactShape; bad: boolean; set: SetFact; numberUnit?: string; unknownOn?: 'none' | 'warn' }) {
  const { t } = useTranslation('insurance-guards')
  const allowed = operatorsFor(shape)
  const fits = allowed.includes(c.op)
  const ops: FactOp[] = fits ? allowed : [...allowed, c.op]
  return (
    <>
      <Field label={t('editor.field.op')}>
        <Select value={c.op} data-input="op" onChange={(e) => set((x) => withOp(x, e.target.value as FactOp, shape))}>
          {ops.map((o) => (
            <option key={o} value={o}>
              {t(`editor.factOp.${o}`)}
            </option>
          ))}
        </Select>
      </Field>
      <ValueFields c={c} shape={shape} bad={bad} set={set} numberUnit={numberUnit} />
      {!fits && shape.known && (
        <span className="text-xs text-attention-800" data-fact-misfit="">
          {t('editor.factTest.notAllowed')}
        </span>
      )}
      {unknownOn && (
        <span className="w-full text-xs text-muted-foreground" data-fact-unknown={unknownOn}>
          {t(`editor.factTest.unknown.${unknownOn}`)}
        </span>
      )}
    </>
  )
}
