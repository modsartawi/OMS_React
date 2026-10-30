import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import {
  addLine,
  LINE_FIELDS,
  moveLine,
  NUMBER_FIELDS,
  PATIENT_FIELDS,
  removeLine,
  REQUEST_FIELDS,
  type AttributeRow,
  type DataForm,
  type FormSection,
} from './data-form'

/**
 * The Data pane's Form (ticket 682): request, patient and lines, each with its attributes, over the SAME dataset as
 * the JSON tab. Every edit hands back a whole new form; the pane writes it to the data box. Every value is a machine
 * value typed left to right, except attribute values, which may be free text in either script.
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
    </div>
  )
}

function SectionBox({ title, hook, children }: { title: string; hook: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" data-form-section={hook}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
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

function Attributes({ rows, path, onChange }: { rows: AttributeRow[]; path: string; onChange: (rows: AttributeRow[]) => void }) {
  const { t } = useTranslation('insurance-playground')
  const set = (i: number, r: AttributeRow) => onChange(rows.map((x, j) => (j === i ? r : x)))
  return (
    <div className="flex flex-col gap-1" data-form-attributes={path}>
      <span className="text-xs font-medium text-muted-foreground">{t('data.form.attributes')}</span>
      <span className="text-[11px] text-muted-foreground">{t('data.form.attributesHint')}</span>
      {rows.map((r, i) => (
        <div key={i} className="flex items-end gap-1" data-form-attribute={i}>
          <Field label={t('data.form.attributeKey')} hideLabel className="flex-1">
            <Input dir="ltr" className="w-full font-mono" spellCheck={false} placeholder={t('data.form.attributeKey')} value={r.key} onChange={(e) => set(i, { ...r, key: e.target.value })} data-form-attribute-key="" />
          </Field>
          <Field label={t('data.form.attributeValue')} hideLabel className="flex-1">
            <Input dir="auto" className="w-full" spellCheck={false} placeholder={t('data.form.attributeValue')} value={r.value} onChange={(e) => set(i, { ...r, value: e.target.value })} data-form-attribute-value="" />
          </Field>
          <IconButton label={t('data.form.attributeRemove')} onClick={() => onChange(rows.filter((_, j) => j !== i))} data-form-attribute-remove="">
            <X className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      ))}
      <Button variant="ghost" className="w-fit" onClick={() => onChange([...rows, { key: '', value: '' }])} data-form-add-attribute="">
        <Plus className="size-3.5" aria-hidden />
        {t('data.form.addAttribute')}
      </Button>
    </div>
  )
}
