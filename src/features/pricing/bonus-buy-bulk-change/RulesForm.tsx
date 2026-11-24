import { useTranslation } from 'react-i18next'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'
import { BBY_BULK_LIST_FIELDS } from '@/core/models/bonus-buy-bulk'
import { fsi } from '@/core/util/bidi'
import {
  LIST_OPS,
  NUMBER_OPS,
  STACKABLE_OPS,
  TIME_OPS,
  type BulkForm,
  type FormProblem,
  type ListOp,
  type NumberOp,
  type StackableOp,
  type TimeOp,
} from './operations'

/**
 * The engine-rules form (spec 4190, design F): every field opens on **Leave**. Each field is an
 * operation picker and, when the operation takes one, its value. The form only states the change;
 * what it does to each bonus buy is the server's dry run.
 */
export default function RulesForm({
  form,
  onChange,
  problems,
  currency,
  disabled,
}: {
  form: BulkForm
  onChange: (f: BulkForm) => void
  problems: readonly FormProblem[]
  /** The selection's currency, for the max value's hint; blank when nothing is selected. */
  currency: string
  disabled?: boolean
}) {
  const { t } = useTranslation('bonus-buy-bulk-change')
  const bad = (p: FormProblem) => (problems.includes(p) ? t(`form.problem.${p}`) : undefined)

  const numberField = (key: 'score' | 'maxValue', step: number, hint?: string) => (
    <div className="flex items-end gap-2">
      <Field label={t(`field.${key}`)} className="w-32">
        <Select
          value={form[key].op}
          disabled={disabled}
          data-testid={`bulk-op-${key}`}
          onChange={(e) => onChange({ ...form, [key]: { ...form[key], op: e.target.value as NumberOp } })}
        >
          {NUMBER_OPS.map((op) => (
            <option key={op} value={op}>
              {t(`op.${op}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('form.value')} hideLabel error={bad(key)} hint={hint} className="w-32">
        <Input
          type="number"
          min={0}
          step={step}
          dir="ltr"
          className="text-end"
          disabled={disabled || form[key].op === 'leave'}
          value={form[key].value}
          data-testid={`bulk-value-${key}`}
          onChange={(e) => onChange({ ...form, [key]: { ...form[key], value: e.target.value } })}
        />
      </Field>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{t('form.hint')}</p>
      <div className="flex flex-wrap items-start gap-6">
        {numberField('score', 1)}
        <Field label={t('field.isStackable')} className="w-32">
          <Select
            value={form.isStackable}
            disabled={disabled}
            data-testid="bulk-op-isStackable"
            onChange={(e) => onChange({ ...form, isStackable: e.target.value as StackableOp })}
          >
            {STACKABLE_OPS.map((op) => (
              <option key={op} value={op}>
                {t(`op.${op}`)}
              </option>
            ))}
          </Select>
        </Field>
        {numberField('maxValue', 0.001, currency ? t('form.maxValueHint', { currency: fsi(currency) }) : undefined)}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('field.timeWindow')} className="w-32">
          <Select
            value={form.timeWindow.op}
            disabled={disabled}
            data-testid="bulk-op-timeWindow"
            onChange={(e) => onChange({ ...form, timeWindow: { ...form.timeWindow, op: e.target.value as TimeOp } })}
          >
            {TIME_OPS.map((op) => (
              <option key={op} value={op}>
                {t(`op.${op}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('form.timeFrom')} className="w-36" error={bad('timeWindow')}>
          <Input
            type="time"
            step={1}
            disabled={disabled || form.timeWindow.op !== 'set'}
            value={form.timeWindow.from}
            onChange={(e) => onChange({ ...form, timeWindow: { ...form.timeWindow, from: e.target.value } })}
          />
        </Field>
        <Field label={t('form.timeTo')} className="w-36">
          <Input
            type="time"
            step={1}
            disabled={disabled || form.timeWindow.op !== 'set'}
            value={form.timeWindow.to}
            onChange={(e) => onChange({ ...form, timeWindow: { ...form.timeWindow, to: e.target.value } })}
          />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">{t('form.listHint')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {BBY_BULK_LIST_FIELDS.map((key) => {
          const entry = form.lists[key]
          const takesCodes = entry.op !== 'leave' && entry.op !== 'clear'
          const set = (patch: Partial<typeof entry>) =>
            onChange({ ...form, lists: { ...form.lists, [key]: { ...entry, ...patch } } })
          return (
            <div key={key} className="flex min-w-0 items-start gap-2" data-testid={`bulk-list-${key}`}>
              <Field label={t(`field.${key}`)} className="w-32 shrink-0">
                <Select
                  value={entry.op}
                  disabled={disabled}
                  data-testid={`bulk-op-${key}`}
                  onChange={(e) => set({ op: e.target.value as ListOp })}
                >
                  {LIST_OPS.map((op) => (
                    <option key={op} value={op}>
                      {t(`op.${op}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('form.codes')} error={bad(key)} className="min-w-0 flex-1">
                <Textarea
                  dir="ltr"
                  rows={2}
                  className="w-full resize-y font-mono"
                  disabled={disabled || !takesCodes}
                  value={entry.value}
                  data-testid={`bulk-value-${key}`}
                  onChange={(e) => set({ value: e.target.value })}
                />
              </Field>
            </div>
          )
        })}
      </div>
    </div>
  )
}
