/**
 * A planner row's fields in its side sheet (ticket 968): the override form (`./override-form-model`) and the generic
 * form every other table uses (`./tables`). Identity fields are fixed once the row exists — a different store or item
 * is a new row, not a change. Codes are typed as codes. SERVER GAP (spec 4354): no planner door names a store, item,
 * merchandise category or sub-category to pick from.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { OVERRIDE_LEVELS } from '@/core/models/sourcing-planner'
import { NS } from './display'
import { levelsBeaten, overrideKeep, type OverrideForm } from './override-form-model'
import { TABLES, confidenceLastEnd, type FieldSpec, type RowForm } from './tables'
import type { PlannerTableKey } from './wire'

const CodeInput = ({ value, disabled, onChange, field }: { value: string; disabled: boolean; onChange: (v: string) => void; field: string }) => (
  <Input value={value} disabled={disabled} dir="ltr" className="font-mono" onChange={(e) => onChange(e.target.value)} data-field={field} />
)

/** The buffer override's form: the level and its target, units or days or both, the first and last day. */
export function OverrideFields({
  form,
  onChange,
  isNew,
  readOnly,
}: {
  form: OverrideForm
  onChange: (f: OverrideForm) => void
  isNew: boolean
  readOnly: boolean
}) {
  const { t } = useTranslation(NS)
  const set = <K extends keyof OverrideForm>(k: K, v: OverrideForm[K]) => onChange({ ...form, [k]: v })
  const fixed = readOnly || !isNew
  const beaten = levelsBeaten(form.level)
  const keep = overrideKeep(form)
  const label = (k: string) => t(`fields.overrides.${k}`)
  return (
    <div className="grid grid-cols-2 gap-3" data-row-form="overrides">
      <Field
        label={label('level')}
        className="col-span-2"
        hint={
          <span data-level-beats={form.level}>
            {beaten.length === 0
              ? t('override.beatsNone')
              : t('override.beats', { levels: beaten.map((l) => t(`opt.level.${l}`)).join(t('override.listJoin')) })}
          </span>
        }
      >
        <Select value={form.level} disabled={fixed} onChange={(e) => set('level', e.target.value as OverrideForm['level'])} data-field="level">
          {OVERRIDE_LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`opt.level.${l}`)}
            </option>
          ))}
        </Select>
      </Field>
      {(form.level === 'STORE_ITEM' || form.level === 'STORE') && (
        <Field label={label('store')} hint={t('hints.storeCode')}>
          <CodeInput value={form.store} disabled={fixed} onChange={(v) => set('store', v)} field="store" />
        </Field>
      )}
      {(form.level === 'STORE_ITEM' || form.level === 'ITEM') && (
        <Field label={label('item')} hint={t('hints.itemCode')}>
          <CodeInput value={form.item} disabled={fixed} onChange={(v) => set('item', v)} field="item" />
        </Field>
      )}
      {form.level === 'CATEGORY' && (
        <Field label={label('category')} hint={t('hints.categoryCode')}>
          <CodeInput value={form.category} disabled={fixed} onChange={(v) => set('category', v)} field="category" />
        </Field>
      )}
      <Field label={label('keepUnits')} hint={t('hints.overrides.keepUnits')} className="col-start-1">
        <Input type="number" min={0} step={1} dir="ltr" disabled={readOnly} value={form.keepUnits} onChange={(e) => set('keepUnits', e.target.value)} data-field="keepUnits" />
      </Field>
      <Field label={label('keepDays')} hint={t('hints.overrides.keepDays')}>
        <Input type="number" min={0} max={365} step={0.5} dir="ltr" disabled={readOnly} value={form.keepDays} onChange={(e) => set('keepDays', e.target.value)} data-field="keepDays" />
      </Field>
      <p className="col-span-2 text-xs text-muted-foreground" data-keep={keep ?? 'none'}>
        {keep == null ? t('override.keep.none') : t(`override.keep.${keep}`, { units: fsi(form.keepUnits.trim()), days: fsi(form.keepDays.trim()) })}
      </p>
      <Field label={label('firstDay')}>
        <Input type="date" dir="ltr" disabled={readOnly} value={form.firstDay} onChange={(e) => set('firstDay', e.target.value)} data-field="firstDay" />
      </Field>
      <Field label={label('lastDay')} hint={t('hints.overrides.lastDay')}>
        <Input type="date" dir="ltr" disabled={readOnly} value={form.lastDay} min={form.firstDay || undefined} onChange={(e) => set('lastDay', e.target.value)} data-field="lastDay" />
      </Field>
    </div>
  )
}

/** Every other table's form, from its field list. */
export function GenericFields({
  table,
  form,
  onChange,
  isNew,
  readOnly,
  today,
}: {
  table: Exclude<PlannerTableKey, 'overrides'>
  form: RowForm
  onChange: (f: RowForm) => void
  isNew: boolean
  readOnly: boolean
  today: string
}) {
  const { t } = useTranslation(NS)
  const set = (k: string, v: string | boolean) => onChange({ ...form, [k]: v })
  return (
    <div className="grid grid-cols-2 gap-3" data-row-form={table}>
      {TABLES[table].fields.map((f) => {
        const disabled = readOnly || (!isNew && !!f.identity)
        const label = t(`fields.${table}.${f.key}`)
        const hint = t(`hints.${table}.${f.key}`, { defaultValue: '' }) || undefined
        const v = form[f.key]
        if (f.kind === 'bool')
          return (
            <label key={f.key} className="flex items-center gap-2 self-end pb-1 text-sm" data-field={f.key}>
              <input type="checkbox" checked={v === true} disabled={disabled} onChange={(e) => set(f.key, e.target.checked)} />
              {label}
            </label>
          )
        return (
          <Field key={f.key} label={label} hint={hint} className={f.kind === 'text' || f.kind === 'codeList' ? 'col-span-2' : ''}>
            {control(f, String(v ?? ''), disabled, (x) => set(f.key, x))}
          </Field>
        )
      })}
    </div>
  )

  function control(f: FieldSpec, v: string, disabled: boolean, put: (x: string) => void): ReactNode {
    switch (f.kind) {
      case 'select':
        return (
          <Select value={v} disabled={disabled} onChange={(e) => put(e.target.value)} data-field={f.key}>
            {f.optional && <option value="">{t('form.none')}</option>}
            {f.options!.map((o) => (
              <option key={o} value={o}>
                {t(`opt.${f.optSet}.${o}`)}
              </option>
            ))}
          </Select>
        )
      case 'code':
        return <CodeInput value={v} disabled={disabled} onChange={put} field={f.key} />
      case 'codeList':
        return <Input value={v} disabled={disabled} dir="ltr" className="font-mono" onChange={(e) => put(e.target.value)} data-field={f.key} />
      case 'number':
      case 'date':
      case 'time':
        return (
          <Input
            type={f.kind}
            value={v}
            min={f.kind === 'date' && table === 'confidence' ? today : f.min}
            max={f.kind === 'date' && table === 'confidence' ? confidenceLastEnd(today) : f.max}
            step={f.step}
            disabled={disabled}
            dir="ltr"
            onChange={(e) => put(e.target.value)}
            data-field={f.key}
          />
        )
      default:
        return <Input value={v} disabled={disabled} dir="auto" onChange={(e) => put(e.target.value)} data-field={f.key} />
    }
  }
}
