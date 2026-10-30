// The Data pane's Form (ticket 682): the door's `data` as a form, and back. Pure.
//
// The JSON stays the one dataset; the form is a view of it that writes back. Every section and line keeps the object
// it was read from (`base`), and writing back starts from that object: a key the form does not know survives
// untouched, key order is kept, and a value the form shows but nobody edited is written back as it was (so a number
// attribute or a text quantity survives the trip). Only an EDITED field is parsed from the form's text: a number
// field becomes a number when it reads as one (else it stays text, and the engine says so), a cleared field becomes
// null, ICD splits into codes, and attributes are text even when they look like numbers (ADR 0117: typed when read).
//
// 683 adds history / reference / eligibility / payer: a new entry in `FORM_SECTIONS` plus its section in `DataForm`.

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The request's fields the form shows (besides `attributes`). */
export const REQUEST_FIELDS = ['channel', 'store', 'payer', 'policy', 'class', 'pharmacist'] as const
/** The patient's fields the form shows (besides `attributes`). */
export const PATIENT_FIELDS = ['birthDate', 'gender', 'idType'] as const
/** A line's fields the form shows (besides `line`, its number, and `attributes`). */
export const LINE_FIELDS = ['item', 'quantity', 'unit', 'daysSupply', 'icd', 'price', 'eCode', 'dCode', 'sfdaCode', 'idfPriority'] as const

export type RequestField = (typeof REQUEST_FIELDS)[number]
export type PatientField = (typeof PATIENT_FIELDS)[number]
export type LineField = (typeof LINE_FIELDS)[number]

/** The fields read as numbers when edited. */
export const NUMBER_FIELDS: ReadonlySet<string> = new Set<LineField>(['quantity', 'daysSupply', 'price', 'idfPriority'])

/** The data's top-level keys the form shows. 683 extends this. */
export const FORM_SECTIONS = ['request', 'patient', 'lines'] as const

/** One attribute: a registry field's key and its value as text. */
export interface AttributeRow {
  key: string
  value: string
}

/** A section of fields (request, patient, one line): the object it was read from, its fields as text, its attributes. */
export interface FormSection<F extends string> {
  base: Obj
  /** The data held this section (an absent one is written only once something is typed into it). */
  present: boolean
  fields: Record<F, string>
  attributes: AttributeRow[]
}

export interface FormLine extends FormSection<LineField> {
  /** A stable React key; never written. */
  uid: string
}

export interface DataForm {
  base: Obj
  request: FormSection<RequestField>
  patient: FormSection<PatientField>
  lines: FormLine[]
  linesPresent: boolean
  /** Paths of the keys the data holds that the form does not show (`history`, `lines[0].mystery`). */
  more: string[]
}

let uidSeq = 0
const nextUid = () => `l${++uidSeq}`

/** A value as the form's text: empty for null/absent, codes joined for ICD, JSON for anything else that is no scalar. */
function textOf(v: unknown, field?: string): string {
  if (v === null || v === undefined) return ''
  if (field === 'icd' && Array.isArray(v) && v.every((c) => typeof c === 'string')) return v.join(', ')
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function parseText(text: string, field: string): unknown {
  if (field === 'icd') return text.split(/[,\s]+/).filter(Boolean)
  const s = text.trim()
  if (s === '') return null
  if (NUMBER_FIELDS.has(field) && /^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  return text
}

const attributeRows = (v: unknown): AttributeRow[] => (isObj(v) ? Object.entries(v).map(([key, value]) => ({ key, value: textOf(value) })) : [])

function readSection<F extends string>(v: unknown, fields: readonly F[], path: string, more: string[]): FormSection<F> {
  const base = isObj(v) ? v : {}
  const known = new Set<string>([...fields, 'attributes', ...(path.startsWith('lines[') ? ['line'] : [])])
  for (const k of Object.keys(base)) if (!known.has(k)) more.push(`${path}.${k}`)
  return {
    base,
    present: isObj(v),
    fields: Object.fromEntries(fields.map((f) => [f, textOf(base[f], f)])) as Record<F, string>,
    attributes: attributeRows(base.attributes),
  }
}

/** The data → its form, or null when the data has a shape the form cannot hold (then only the JSON edits it). */
export function formFromData(data: unknown): DataForm | null {
  if (!isObj(data)) return null
  for (const k of ['request', 'patient'] as const) if (k in data && !isObj(data[k])) return null
  if ('lines' in data && !(Array.isArray(data.lines) && data.lines.every(isObj))) return null
  const more: string[] = []
  const known = new Set<string>(FORM_SECTIONS)
  let request: FormSection<RequestField> | undefined
  let patient: FormSection<PatientField> | undefined
  let lines: FormLine[] = []
  for (const k of Object.keys(data)) {
    if (k === 'request') request = readSection(data.request, REQUEST_FIELDS, 'request', more)
    else if (k === 'patient') patient = readSection(data.patient, PATIENT_FIELDS, 'patient', more)
    else if (k === 'lines') lines = (data.lines as Obj[]).map((l, i) => ({ ...readSection(l, LINE_FIELDS, `lines[${i}]`, more), uid: nextUid() }))
    else if (!known.has(k)) more.push(k)
  }
  return {
    base: data,
    request: request ?? readSection(undefined, REQUEST_FIELDS, 'request', more),
    patient: patient ?? readSection(undefined, PATIENT_FIELDS, 'patient', more),
    lines,
    linesPresent: 'lines' in data,
    more,
  }
}

const sameRows = (a: AttributeRow[], b: AttributeRow[]) => a.length === b.length && a.every((r, i) => r.key === b[i].key && r.value === b[i].value)

/** One section back to its object, or undefined when it was absent and nothing was typed into it. */
function writeSection<F extends string>(s: FormSection<F>): Obj | undefined {
  const out: Obj = { ...s.base }
  let wrote = false
  for (const [f, text] of Object.entries(s.fields) as [string, string][]) {
    if (text === textOf(s.base[f], f)) continue
    out[f] = parseText(text, f)
    wrote = true
  }
  if (!sameRows(s.attributes, attributeRows(s.base.attributes))) {
    const baseAttrs = isObj(s.base.attributes) ? s.base.attributes : {}
    const attrs: Obj = {}
    for (const r of s.attributes) {
      if (!r.key.trim()) continue
      // Untouched: as it was. Edited or new: text, even when it looks like a number.
      attrs[r.key] = r.key in baseAttrs && textOf(baseAttrs[r.key]) === r.value ? baseAttrs[r.key] : r.value
    }
    out.attributes = attrs
    wrote = true
  }
  return s.present || wrote ? out : undefined
}

/** The form → the door's `data`. */
export function dataFromForm(form: DataForm): Obj {
  const out: Obj = { ...form.base }
  const request = writeSection(form.request)
  const patient = writeSection(form.patient)
  if (request) out.request = request
  if (patient) out.patient = patient
  if (form.linesPresent || form.lines.length) out.lines = form.lines.map((l) => writeSection(l) ?? {})
  return out
}

/** The shape of a new line: the next number, one of an item nobody named yet. */
export function addLine(form: DataForm): DataForm {
  const numbers = form.lines.map((l) => l.base.line).filter((n): n is number => typeof n === 'number')
  const base: Obj = { line: Math.max(0, ...numbers, form.lines.length) + 1, item: null, quantity: 1, unit: null, daysSupply: null, icd: [], price: null, eCode: null, dCode: null, sfdaCode: null, idfPriority: null, attributes: {} }
  const line: FormLine = { ...readSection(base, LINE_FIELDS, `lines[${form.lines.length}]`, []), uid: nextUid() }
  return { ...form, lines: [...form.lines, line] }
}

export function removeLine(form: DataForm, index: number): DataForm {
  return { ...form, lines: form.lines.filter((_, i) => i !== index) }
}

/** Moves a line up (-1) or down (+1); a move past either end does nothing. */
export function moveLine(form: DataForm, index: number, by: -1 | 1): DataForm {
  const to = index + by
  if (to < 0 || to >= form.lines.length) return form
  const lines = [...form.lines]
  ;[lines[index], lines[to]] = [lines[to], lines[index]]
  return { ...form, lines }
}

/** The form → the data box's text (the JSON tab's own layout). */
export const formText = (form: DataForm) => JSON.stringify(dataFromForm(form), null, 2)

/** The data box's text → its form, or why there is none: it does not parse, or the form cannot hold its shape. */
export function formFromText(text: string): { form: DataForm } | { problem: 'invalid' | 'unshaped' } {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return { problem: 'invalid' }
  }
  if (!isObj(v)) return { problem: 'invalid' }
  const form = formFromData(v)
  return form ? { form } : { problem: 'unshaped' }
}
