import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import {
  addFact,
  addHistory,
  addLine,
  addReferenceRow,
  FACT_TYPES,
  HISTORY_FIELDS,
  LINE_FIELDS,
  moveLine,
  NUMBER_FIELDS,
  PATIENT_FIELDS,
  REFERENCE_TABLES,
  removeFact,
  removeHistory,
  removeLine,
  removeReferenceRow,
  REQUEST_FIELDS,
  type AttributeRow,
  type DataForm,
  type DeductibleRow,
  type FactRow,
  type FormEligibility,
  type FormPayer,
  type FormReference,
  type FormSection,
  type ReferenceRow,
} from './data-form'

/**
 * The Data pane's Form (tickets 682, 683): request, patient, lines and history events, each with its attributes;
 * reference rows; eligibility facts; and, for coverage only, the payer — over the SAME dataset as the JSON tab. Every
 * edit hands back a whole new form; the pane writes it to the data box. Every value is a machine value typed left to
 * right, except attribute, reference-field and text-fact values, which may be free text in either script. An empty
 * history or reference reads "none" (a first-time patient), not a blank. A section the form cannot hold is absent
 * here and named in the "more" note.
 */
export function DataFormView({ form, onChange }: { form: DataForm; onChange: (form: DataForm) => void }) {
  const { t } = useTranslation('insurance-playground')
  const setLine = (i: number, s: FormSection<(typeof LINE_FIELDS)[number]>) => onChange({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, ...s } : l)) })
  return (
    <div className="flex flex-col gap-4" data-data-form="">
      {form.more.length > 0 && (
        <div className="rounded-md border border-dashed border-border/60 p-2 text-xs text-muted-foreground" role="note" data-form-more="">
          <p>{t('data.form.more')}</p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono">
            {form.more.map((p) => (
              <li key={p} data-form-more-key={p}>
                <Ltr>{p}</Ltr>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SectionBox title={t('data.form.request')} hook="request">
        <Fields section={form.request} names={REQUEST_FIELDS} path="request" onChange={(request) => onChange({ ...form, request })} />
        <Attributes rows={form.request.attributes} path="request" onChange={(attributes) => onChange({ ...form, request: { ...form.request, attributes } })} />
      </SectionBox>

      <SectionBox title={t('data.form.patient')} hook="patient">
        <Fields section={form.patient} names={PATIENT_FIELDS} path="patient" onChange={(patient) => onChange({ ...form, patient })} />
        <Attributes rows={form.patient.attributes} path="patient" onChange={(attributes) => onChange({ ...form, patient: { ...form.patient, attributes } })} />
      </SectionBox>

      <SectionBox title={t('data.form.lines')} hook="lines">
        {form.lines.length === 0 && <p className="text-xs text-muted-foreground">{t('data.form.noLines')}</p>}
        {form.lines.map((line, i) => {
          const n = fsi(typeof line.base.line === 'number' || typeof line.base.line === 'string' ? line.base.line : i + 1)
          return (
            <article key={line.uid} className="flex flex-col gap-2 border-t border-border/60 pt-2" data-form-line={i}>
              <header className="flex items-center gap-1">
                <h4 className="text-sm font-medium">{t('data.form.line', { n })}</h4>
                <span className="ms-auto flex gap-1">
                  <IconButton label={t('data.form.lineUp', { n })} disabled={i === 0} onClick={() => onChange(moveLine(form, i, -1))} data-form-line-up="">
                    <ArrowUp className="size-3.5" aria-hidden />
                  </IconButton>
                  <IconButton label={t('data.form.lineDown', { n })} disabled={i === form.lines.length - 1} onClick={() => onChange(moveLine(form, i, 1))} data-form-line-down="">
                    <ArrowDown className="size-3.5" aria-hidden />
                  </IconButton>
                  <IconButton label={t('data.form.lineRemove', { n })} onClick={() => onChange(removeLine(form, i))} data-form-line-remove="">
                    <Trash2 className="size-3.5" aria-hidden />
                  </IconButton>
                </span>
              </header>
              <Fields section={line} names={LINE_FIELDS} path={`lines.${i}`} onChange={(s) => setLine(i, s)} />
              <Attributes rows={line.attributes} path={`lines.${i}`} onChange={(attributes) => setLine(i, { ...line, attributes })} />
            </article>
          )
        })}
        <Button variant="secondary" className="w-fit" onClick={() => onChange(addLine(form))} data-form-add-line="">
          <Plus className="size-3.5" aria-hidden />
          {t('data.form.addLine')}
        </Button>
      </SectionBox>

      {form.history && (
        <SectionBox title={t('data.form.history')} hint={t('data.form.historyHint')} hook="history">
          {form.history.length === 0 && <None hook="history">{t('data.form.historyNone')}</None>}
          {form.history.map((ev, i) => {
            const n = fsi(i + 1)
            const setEvent = (s: FormSection<(typeof HISTORY_FIELDS)[number]>) => onChange({ ...form, history: form.history!.map((e, j) => (j === i ? { ...e, ...s } : e)) })
            return (
              <article key={ev.uid} className="flex flex-col gap-2 border-t border-border/60 pt-2" data-form-event={i}>
                <header className="flex items-center gap-1">
                  <h4 className="text-sm font-medium">{t('data.form.event', { n })}</h4>
                  <span className="ms-auto">
                    <IconButton label={t('data.form.eventRemove', { n })} onClick={() => onChange(removeHistory(form, i))} data-form-event-remove="">
                      <Trash2 className="size-3.5" aria-hidden />
                    </IconButton>
                  </span>
                </header>
                <Fields section={ev} names={HISTORY_FIELDS} path={`history.${i}`} onChange={setEvent} />
                <Attributes rows={ev.attributes} path={`history.${i}`} onChange={(attributes) => setEvent({ ...ev, attributes })} />
              </article>
            )
          })}
          <Button variant="secondary" className="w-fit" onClick={() => onChange(addHistory(form))} data-form-add-event="">
            <Plus className="size-3.5" aria-hidden />
            {t('data.form.addEvent')}
          </Button>
        </SectionBox>
      )}

      {form.reference && <ReferenceSection reference={form.reference} onChange={(reference) => onChange({ ...form, reference })} onAdd={() => onChange(addReferenceRow(form))} onRemove={(i) => onChange(removeReferenceRow(form, i))} />}

      {form.eligibility && <EligibilitySection eligibility={form.eligibility} onChange={(eligibility) => onChange({ ...form, eligibility })} onAdd={() => onChange(addFact(form))} onRemove={(i) => onChange(removeFact(form, i))} />}

      {form.payer && <PayerSection payer={form.payer} onChange={(payer) => onChange({ ...form, payer })} />}
    </div>
  )
}

function SectionBox({ title, hint, hook, children }: { title: string; hint?: string; hook: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" data-form-section={hook}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

/** An empty section's words: "none", never a blank. */
function None({ hook, children }: { hook: string; children: ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground" data-form-none={hook}>
      {children}
    </p>
  )
}

function ReferenceSection({ reference, onChange, onAdd, onRemove }: { reference: FormReference; onChange: (r: FormReference) => void; onAdd: () => void; onRemove: (i: number) => void }) {
  const { t } = useTranslation('insurance-playground')
  const set = (i: number, r: ReferenceRow) => onChange({ ...reference, rows: reference.rows.map((x, j) => (j === i ? r : x)) })
  const known = new Set<string>(REFERENCE_TABLES)
  return (
    <SectionBox title={t('data.form.reference')} hint={t('data.form.referenceHint')} hook="reference">
      {reference.rows.length === 0 && <None hook="reference">{t('data.form.referenceNone')}</None>}
      {reference.rows.map((r, i) => {
        const n = fsi(i + 1)
        // The data may name a table this page does not know: it stays a choice, shown as the machine name it is.
        const tables = [...REFERENCE_TABLES, ...[...Object.keys(reference.kinds), r.table].filter((x, k, all) => x && !known.has(x) && all.indexOf(x) === k)]
        return (
          <article key={r.uid} className="flex flex-col gap-2 border-t border-border/60 pt-2" data-form-ref-row={i}>
            <header className="flex items-center gap-1">
              <h4 className="text-sm font-medium">{t('data.form.refRow', { n })}</h4>
              <span className="ms-auto">
                <IconButton label={t('data.form.refRemove', { n })} onClick={() => onRemove(i)} data-form-ref-remove="">
                  <Trash2 className="size-3.5" aria-hidden />
                </IconButton>
              </span>
            </header>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('data.form.refTable')}>
                <Select className="w-full" value={r.table} onChange={(e) => set(i, { ...r, table: e.target.value })} data-form-ref-table="">
                  {tables.map((x) => (
                    <option key={x} value={x}>
                      {known.has(x) ? t(`data.form.tables.${x}`) : fsi(x)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('data.form.refCode')}>
                <Input dir="ltr" className="w-full font-mono" spellCheck={false} value={r.code} onChange={(e) => set(i, { ...r, code: e.target.value })} data-form-ref-code="" />
              </Field>
            </div>
            <Attributes
              rows={r.fields}
              path={`reference.${i}`}
              label={t('data.form.refFields')}
              hint={t('data.form.refFieldsHint')}
              keyLabel={t('data.form.fieldKey')}
              valueLabel={t('data.form.fieldValue')}
              removeLabel={t('data.form.fieldRemove')}
              addLabel={t('data.form.addField')}
              onChange={(fields) => set(i, { ...r, fields })}
            />
          </article>
        )
      })}
      <Button variant="secondary" className="w-fit" onClick={onAdd} data-form-add-ref="">
        <Plus className="size-3.5" aria-hidden />
        {t('data.form.addRef')}
      </Button>
    </SectionBox>
  )
}

function EligibilitySection({ eligibility, onChange, onAdd, onRemove }: { eligibility: FormEligibility; onChange: (e: FormEligibility) => void; onAdd: () => void; onRemove: (i: number) => void }) {
  const { t } = useTranslation('insurance-playground')
  const set = (i: number, f: FactRow) => onChange({ ...eligibility, facts: eligibility.facts.map((x, j) => (j === i ? f : x)) })
  const known = new Set<string>(FACT_TYPES)
  return (
    <SectionBox title={t('data.form.eligibility')} hint={t('data.form.eligibilityHint')} hook="eligibility">
      {eligibility.facts.length === 0 && <None hook="eligibility">{t('data.form.eligibilityNone')}</None>}
      {eligibility.facts.map((f, i) => {
        const n = fsi(i + 1)
        const types = known.has(f.type) || !f.type ? FACT_TYPES : [...FACT_TYPES, f.type]
        return (
          <div key={f.uid} className="grid grid-cols-[2fr_1fr_2fr_1fr_auto] items-end gap-1" data-form-fact={i}>
            <Field label={t('data.form.factKey')}>
              <Input dir="ltr" className="w-full font-mono" spellCheck={false} value={f.key} onChange={(e) => set(i, { ...f, key: e.target.value })} data-form-fact-key="" />
            </Field>
            <Field label={t('data.form.factType')}>
              <Select className="w-full" value={f.type} onChange={(e) => set(i, { ...f, type: e.target.value })} data-form-fact-type="">
                {types.map((x) => (
                  <option key={x} value={x}>
                    {known.has(x) ? t(`data.form.types.${x}`) : fsi(x)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('data.form.factValue')} hint={f.type === 'flag' ? t('data.form.factFlagHint') : undefined}>
              <Input
                dir={f.type === 'text' ? 'auto' : 'ltr'}
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                className={`w-full ${f.type === 'text' ? '' : 'font-mono'}`}
                spellCheck={false}
                value={f.value}
                onChange={(e) => set(i, { ...f, value: e.target.value })}
                data-form-fact-value=""
              />
            </Field>
            <Field label={t('data.form.factUnit')}>
              <Input dir="ltr" className="w-full font-mono" spellCheck={false} value={f.unit} onChange={(e) => set(i, { ...f, unit: e.target.value })} data-form-fact-unit="" />
            </Field>
            <IconButton label={t('data.form.factRemove', { n })} onClick={() => onRemove(i)} data-form-fact-remove="">
              <X className="size-3.5" aria-hidden />
            </IconButton>
          </div>
        )
      })}
      <Button variant="secondary" className="w-fit" onClick={onAdd} data-form-add-fact="">
        <Plus className="size-3.5" aria-hidden />
        {t('data.form.addFact')}
      </Button>
    </SectionBox>
  )
}

function PayerSection({ payer, onChange }: { payer: FormPayer; onChange: (p: FormPayer) => void }) {
  const { t } = useTranslation('insurance-playground')
  const set = (i: number, d: DeductibleRow) => onChange({ ...payer, deductibles: payer.deductibles.map((x, j) => (j === i ? d : x)) })
  return (
    <SectionBox title={t('data.form.payer')} hint={t('data.form.payerHint')} hook="payer">
      {payer.deductibles.map((d, i) => {
        const group = fsi(d.group)
        return (
          <div key={d.group} className="grid grid-cols-[auto_1fr_1fr] items-end gap-2" data-form-deductible={d.group}>
            <span className="pb-2 font-mono text-sm">
              <Ltr>{d.group}</Ltr>
            </span>
            <Field label={t('data.form.deductiblePercent', { group })}>
              <Input dir="ltr" className="w-full font-mono" inputMode="decimal" spellCheck={false} value={d.percent} onChange={(e) => set(i, { ...d, percent: e.target.value })} data-form-deductible-percent="" />
            </Field>
            <Field label={t('data.form.deductibleMax', { group })}>
              <Input dir="ltr" className="w-full font-mono" inputMode="decimal" spellCheck={false} value={d.max} onChange={(e) => set(i, { ...d, max: e.target.value })} data-form-deductible-max="" />
            </Field>
          </div>
        )
      })}
    </SectionBox>
  )
}

function Fields<F extends string>({ section, names, path, onChange }: { section: FormSection<F>; names: readonly F[]; path: string; onChange: (s: FormSection<F>) => void }) {
  const { t } = useTranslation('insurance-playground')
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {names.map((f) => (
        <Field key={f} label={t(`data.form.fields.${f}`)} hint={f === 'icd' ? t('data.form.icdHint') : undefined}>
          <Input
            dir="ltr"
            className="w-full font-mono"
            inputMode={NUMBER_FIELDS.has(f) ? 'decimal' : undefined}
            spellCheck={false}
            value={section.fields[f]}
            onChange={(e) => onChange({ ...section, fields: { ...section.fields, [f]: e.target.value } })}
            data-form-field={`${path}.${f}`}
          />
        </Field>
      ))}
    </div>
  )
}

/** Key/value rows: a section's attributes, or a reference row's fields (then with that section's own words). */
function Attributes({
  rows,
  path,
  onChange,
  ...words
}: {
  rows: AttributeRow[]
  path: string
  onChange: (rows: AttributeRow[]) => void
  label?: string
  hint?: string
  keyLabel?: string
  valueLabel?: string
  removeLabel?: string
  addLabel?: string
}) {
  const { t } = useTranslation('insurance-playground')
  const label = words.label ?? t('data.form.attributes')
  const hint = words.hint ?? t('data.form.attributesHint')
  const keyLabel = words.keyLabel ?? t('data.form.attributeKey')
  const valueLabel = words.valueLabel ?? t('data.form.attributeValue')
  const removeLabel = words.removeLabel ?? t('data.form.attributeRemove')
  const addLabel = words.addLabel ?? t('data.form.addAttribute')
  const set = (i: number, r: AttributeRow) => onChange(rows.map((x, j) => (j === i ? r : x)))
  return (
    <div className="flex flex-col gap-1" data-form-attributes={path}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
      {rows.map((r, i) => (
        <div key={i} className="flex items-end gap-1" data-form-attribute={i}>
          <Field label={keyLabel} hideLabel className="flex-1">
            <Input dir="ltr" className="w-full font-mono" spellCheck={false} placeholder={keyLabel} value={r.key} onChange={(e) => set(i, { ...r, key: e.target.value })} data-form-attribute-key="" />
          </Field>
          <Field label={valueLabel} hideLabel className="flex-1">
            <Input dir="auto" className="w-full" spellCheck={false} placeholder={valueLabel} value={r.value} onChange={(e) => set(i, { ...r, value: e.target.value })} data-form-attribute-value="" />
          </Field>
          <IconButton label={removeLabel} onClick={() => onChange(rows.filter((_, j) => j !== i))} data-form-attribute-remove="">
            <X className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      ))}
      <Button variant="ghost" className="w-fit" onClick={() => onChange([...rows, { key: '', value: '' }])} data-form-add-attribute="">
        <Plus className="size-3.5" aria-hidden />
        {addLabel}
      </Button>
    </div>
  )
}
