// The Data pane's Form (ticket 682): the door's `data` as a form, and back. Pure.
//
// The JSON stays the one dataset; the form is a view of it that writes back. Every section and line keeps the object
// it was read from (`base`), and writing back starts from that object: a key the form does not know survives
// untouched, key order is kept, and a value the form shows but nobody edited is written back as it was (so a number
// attribute or a text quantity survives the trip). Only an EDITED field is parsed from the form's text: a number
// field becomes a number when it reads as one (else it stays text, and the engine says so), a cleared field becomes
// null, ICD splits into codes, and attributes are text even when they look like numbers (ADR 0117: typed when read).
//
// 683 adds history (events, like lines), reference (SFDA / CHI rows per table and code), eligibility (facts: key,
// type, value, unit) and the coverage payer (deductible per group). A section the data holds in a shape the form
// cannot show is NOT a refusal of the whole form: it is kept as JSON and named in `more`. The shapes of reference and
// payer are the brief's names (engine GuardReference / CoveragePayer), reconciled in 691.

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The request's fields the form shows (besides `attributes`). */
export const REQUEST_FIELDS = ['channel', 'store', 'payer', 'policy', 'class', 'pharmacist'] as const
/** The patient's fields the form shows (besides `attributes`). */
export const PATIENT_FIELDS = ['birthDate', 'gender', 'idType'] as const
/** A line's fields the form shows (besides `line`, its number, and `attributes`). */
export const LINE_FIELDS = ['item', 'quantity', 'unit', 'daysSupply', 'icd', 'price', 'eCode', 'dCode', 'sfdaCode', 'idfPriority'] as const

/** A history event's fields the form shows (besides `attributes`). */
export const HISTORY_FIELDS = ['on', 'item', 'quantity', 'daysSupply', 'store', 'payer'] as const

export type RequestField = (typeof REQUEST_FIELDS)[number]
export type PatientField = (typeof PATIENT_FIELDS)[number]
export type LineField = (typeof LINE_FIELDS)[number]
export type HistoryField = (typeof HISTORY_FIELDS)[number]

/** The fields read as numbers when edited (a line's and a history event's). */
export const NUMBER_FIELDS: ReadonlySet<string> = new Set<LineField | HistoryField>(['quantity', 'daysSupply', 'price', 'idfPriority'])

/** The data's top-level keys the form shows (`payer` only for a coverage experiment). */
export const FORM_SECTIONS = ['request', 'patient', 'lines', 'history', 'reference', 'eligibility', 'payer'] as const

/** An eligibility fact's types (the field registry's `type`); the value sits under the key of its type. */
export const FACT_TYPES = ['number', 'text', 'flag', 'date'] as const

/** GUESS (691): the engine's GuardReference tables — SFDA product rows (one per code), formulary mapping and
 * indication rows (a list per code). A table the data names that is not one of these is still shown. */
export const REFERENCE_TABLES = ['sfda', 'mapped', 'formulary'] as const

/** The deductible groups a payer states (the engine's CoveragePayer.Deductibles). */
export const DEDUCTIBLE_GROUPS = ['G1', 'G2', 'G3'] as const

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

export interface FormEvent extends FormSection<HistoryField> {
  uid: string
}

/** One reference row: the table it sits in, the code it is filed under, its fields as key/value text. */
export interface ReferenceRow {
  uid: string
  table: string
  code: string
  /** The row it was read from; null for a new row. */
  base: Obj | null
  fields: AttributeRow[]
}

export interface FormReference {
  base: Obj
  present: boolean
  /** Per table the data names: one row per code (`one`) or a list (`many`). */
  kinds: Record<string, 'one' | 'many'>
  rows: ReferenceRow[]
}

/** One eligibility fact as the form shows it; `value` is the text of the slot its type names. */
export interface FactRow {
  uid: string
  key: string
  type: string
  value: string
  unit: string
  /** The fact object it was read from; null for a new fact. */
  base: Obj | null
}

export interface FormEligibility {
  base: Obj
  present: boolean
  facts: FactRow[]
}

/** One deductible group of the payer: its percent and maximum as text. */
export interface DeductibleRow {
  group: string
  percent: string
  max: string
  /** The group's object as read; null when the payer did not state the group. */
  base: Obj | null
}

export interface FormPayer {
  base: Obj
  present: boolean
  deductibles: DeductibleRow[]
}

export interface DataForm {
  base: Obj
  request: FormSection<RequestField>
  patient: FormSection<PatientField>
  lines: FormLine[]
  linesPresent: boolean
  /** History events; null when the data holds a history the form cannot show (kept as JSON). */
  history: FormEvent[] | null
  historyPresent: boolean
  /** Null when the data's reference is a shape the form cannot show (kept as JSON). */
  reference: FormReference | null
  eligibility: FormEligibility | null
  /** Coverage only; null for another kind, or a payer the form cannot show (kept as JSON). */
  payer: FormPayer | null
  /** Paths of the keys the data holds that the form does not show (`history`, `lines[0].mystery`). */
  more: string[]
}

/** What the form reads: the payer is a form section only for a coverage experiment. */
export interface FormOptions {
  payer?: boolean
}

let uidSeq = 0
const nextUid = () => `u${++uidSeq}`

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
export function formFromData(data: unknown, options: FormOptions = {}): DataForm | null {
  if (!isObj(data)) return null
  for (const k of ['request', 'patient'] as const) if (k in data && !isObj(data[k])) return null
  if ('lines' in data && !(Array.isArray(data.lines) && data.lines.every(isObj))) return null
  const more: string[] = []
  const known = new Set<string>(FORM_SECTIONS)
  let request: FormSection<RequestField> | undefined
  let patient: FormSection<PatientField> | undefined
  let lines: FormLine[] = []
  let history: FormEvent[] | null = []
  let reference: FormReference | null = readReference(undefined, more)
  let eligibility: FormEligibility | null = readEligibility(undefined)
  let payer: FormPayer | null = options.payer ? readPayer(undefined, more) : null
  for (const k of Object.keys(data)) {
    const v = data[k]
    if (k === 'request') request = readSection(v, REQUEST_FIELDS, 'request', more)
    else if (k === 'patient') patient = readSection(v, PATIENT_FIELDS, 'patient', more)
    else if (k === 'lines') lines = (v as Obj[]).map((l, i) => ({ ...readSection(l, LINE_FIELDS, `lines[${i}]`, more), uid: nextUid() }))
    else if (k === 'history') {
      history = Array.isArray(v) && v.every(isObj) ? v.map((e, i) => ({ ...readSection(e, HISTORY_FIELDS, `history[${i}]`, more), uid: nextUid() })) : null
      if (!history) more.push(k)
    } else if (k === 'reference') {
      reference = readReference(v, more)
      if (!reference) more.push(k)
    } else if (k === 'eligibility') {
      eligibility = readEligibility(v)
      if (!eligibility) more.push(k)
    } else if (k === 'payer') {
      payer = options.payer ? readPayer(v, more) : null
      if (!payer) more.push(k)
    } else if (!known.has(k)) more.push(k)
  }
  return {
    base: data,
    request: request ?? readSection(undefined, REQUEST_FIELDS, 'request', more),
    patient: patient ?? readSection(undefined, PATIENT_FIELDS, 'patient', more),
    lines,
    linesPresent: 'lines' in data,
    history,
    historyPresent: 'history' in data,
    reference,
    eligibility,
    payer,
    more,
  }
}

// ── Reference rows ──────────────────────────────────────────────────────────────────────

/** A reference table: per code, one row object or a list of row objects. */
const isTable = (v: unknown): v is Obj => isObj(v) && Object.values(v).every((r) => isObj(r) || (Array.isArray(r) && r.every(isObj)))

/** A row field as text: a list of codes joined with commas, anything else as a line or attribute value. */
const cellText = (v: unknown) => (Array.isArray(v) && v.every((c) => typeof c === 'string') ? v.join(', ') : textOf(v))

const kindByName = (table: string): 'one' | 'many' => (table === 'sfda' ? 'one' : 'many')

function readReference(v: unknown, more: string[]): FormReference | null {
  if (v !== undefined && !isObj(v)) return null
  const base = isObj(v) ? v : {}
  const known = new Set<string>(REFERENCE_TABLES)
  const kinds: Record<string, 'one' | 'many'> = {}
  const rows: ReferenceRow[] = []
  const skipped: string[] = []
  for (const [table, t] of Object.entries(base)) {
    if (!isTable(t)) {
      if (known.has(table)) return null
      skipped.push(`reference.${table}`)
      continue
    }
    const entries = Object.values(t)
    kinds[table] = entries.some(Array.isArray) ? 'many' : entries.length ? 'one' : kindByName(table)
    for (const [code, r] of Object.entries(t))
      for (const row of Array.isArray(r) ? r : [r]) rows.push({ uid: nextUid(), table, code, base: row, fields: Object.entries(row).map(([key, x]) => ({ key, value: cellText(x) })) })
  }
  more.push(...skipped)
  return { base, present: isObj(v), kinds, rows }
}

/** An edited row field keeps the type its key had: a number, a list of codes, a flag; else (and a new key) text. */
function cellValue(text: string, was: unknown): unknown {
  const s = text.trim()
  if (s === '') return null
  if (typeof was === 'number' && /^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  if (Array.isArray(was)) return s.split(/[,\s]+/).filter(Boolean)
  if (typeof was === 'boolean' && /^(true|false)$/i.test(s)) return s.toLowerCase() === 'true'
  return text
}

function writeRow(r: ReferenceRow): Obj {
  const base = r.base ?? {}
  const out: Obj = {}
  for (const f of r.fields) {
    if (!f.key.trim()) continue
    out[f.key] = f.key in base && cellText(base[f.key]) === f.value ? base[f.key] : cellValue(f.value, base[f.key])
  }
  const same = r.base && Object.keys(out).length === Object.keys(base).length && Object.keys(out).every((k) => out[k] === base[k])
  return same ? (r.base as Obj) : out
}

function writeReference(ref: FormReference): Obj | undefined {
  const out: Obj = { ...ref.base }
  const built: Record<string, Obj> = {}
  for (const table of Object.keys(ref.kinds)) {
    built[table] = {}
    // An empty list under a code holds no row, so it is carried over as it was.
    for (const [code, r] of Object.entries(ref.base[table] as Obj)) if (Array.isArray(r) && r.length === 0) built[table][code] = []
  }
  for (const r of ref.rows) {
    const table = r.table.trim()
    const code = r.code.trim()
    if (!table || !code) continue
    const t = (built[table] ??= {})
    const row = writeRow(r)
    if ((ref.kinds[table] ?? kindByName(table)) === 'many') t[code] = [...((t[code] as Obj[] | undefined) ?? []), row]
    else t[code] = row
  }
  Object.assign(out, built)
  return ref.present || Object.keys(built).length ? out : undefined
}

// ── Eligibility facts ───────────────────────────────────────────────────────────────────

/**
 * The eligibility block → its facts as the form shows them, or null when it is no object of fact objects. Pure; with
 * `writeEligibility` the pair 685 uses to put a Flatten answer's facts in the form.
 */
export function readEligibility(v: unknown): FormEligibility | null {
  if (v !== undefined && !(isObj(v) && Object.values(v).every(isObj))) return null
  const base = isObj(v) ? v : {}
  const facts = Object.entries(base as Record<string, Obj>).map(([key, f]): FactRow => {
    const type = typeof f.type === 'string' ? f.type : ''
    return { uid: nextUid(), key, type, value: type ? textOf(f[type]) : '', unit: typeof f.unit === 'string' ? f.unit : '', base: f }
  })
  return { base, present: isObj(v), facts }
}

function factValue(type: string, text: string): unknown {
  const s = text.trim()
  if (s === '') return null
  if (type === 'number' && /^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  if (type === 'flag' && /^(true|false)$/i.test(s)) return s.toLowerCase() === 'true'
  return text
}

function writeFact(f: FactRow): Obj {
  const b = f.base
  const readType = b && typeof b.type === 'string' ? b.type : ''
  if (b && f.type === readType && f.value === (readType ? textOf(b[readType]) : '') && f.unit === (typeof b.unit === 'string' ? b.unit : '')) return b
  const out: Obj = { ...(b ?? {}) }
  if (readType && readType !== f.type) delete out[readType]
  out.type = f.type
  out[f.type] = f.value === (b ? textOf(b[f.type]) : '') && b && f.type in b ? b[f.type] : factValue(f.type, f.value)
  if (f.unit !== '' || (b && 'unit' in b)) out.unit = f.unit
  return out
}

/** The form's facts → the eligibility block (`{ key: { type, <type>: value, unit } }`); a fact with no key is not written. */
export function writeEligibility(e: FormEligibility): Obj {
  const out: Obj = {}
  for (const f of e.facts) if (f.key.trim()) out[f.key.trim()] = writeFact(f)
  return out
}

// ── The coverage payer ──────────────────────────────────────────────────────────────────

function readPayer(v: unknown, more: string[]): FormPayer | null {
  if (v !== undefined && !isObj(v)) return null
  const base = isObj(v) ? v : {}
  const ded = base.deductibles
  if (ded !== undefined && !(isObj(ded) && Object.values(ded).every(isObj))) return null
  for (const k of Object.keys(base)) if (k !== 'deductibles') more.push(`payer.${k}`)
  const stated = (isObj(ded) ? ded : {}) as Record<string, Obj>
  const groups = [...Object.keys(stated), ...DEDUCTIBLE_GROUPS.filter((g) => !(g in stated))]
  const deductibles = groups.map((group): DeductibleRow => {
    const b = stated[group] ?? null
    return { group, percent: textOf(b?.percent), max: textOf(b?.max), base: b }
  })
  return { base, present: isObj(v), deductibles }
}

const numberOrText = (text: string) => {
  const s = text.trim()
  return s === '' ? null : /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : text
}

function writePayer(p: FormPayer): Obj | undefined {
  const out: Obj = { ...p.base }
  const stated = isObj(p.base.deductibles) ? p.base.deductibles : undefined
  const ded: Obj = { ...(stated ?? {}) }
  let wrote = false
  for (const d of p.deductibles) {
    if (d.base) {
      if (d.percent === textOf(d.base.percent) && d.max === textOf(d.base.max)) continue
      const next: Obj = { ...d.base }
      if (d.percent !== textOf(d.base.percent)) next.percent = numberOrText(d.percent)
      if (d.max !== textOf(d.base.max)) next.max = numberOrText(d.max)
      ded[d.group] = next
    } else if (d.percent.trim() || d.max.trim()) {
      ded[d.group] = { percent: numberOrText(d.percent), max: numberOrText(d.max) }
      wrote = true
    }
  }
  if (stated || wrote) out.deductibles = ded
  return p.present || wrote ? out : undefined
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
  if (form.history && (form.historyPresent || form.history.length)) out.history = form.history.map((e) => writeSection(e) ?? {})
  const reference = form.reference && writeReference(form.reference)
  if (reference) out.reference = reference
  if (form.eligibility && (form.eligibility.present || form.eligibility.facts.some((f) => f.key.trim()))) out.eligibility = writeEligibility(form.eligibility)
  const payer = form.payer && writePayer(form.payer)
  if (payer) out.payer = payer
  return out
}

/** A new history event: an earlier dispense of one of an item nobody named yet. */
export function addHistory(form: DataForm): DataForm {
  if (!form.history) return form
  const base: Obj = { on: null, item: null, quantity: 1, daysSupply: null, store: null, payer: null, attributes: {} }
  return { ...form, history: [...form.history, { ...readSection(base, HISTORY_FIELDS, `history[${form.history.length}]`, []), uid: nextUid() }] }
}

export const removeHistory = (form: DataForm, index: number): DataForm => (form.history ? { ...form, history: form.history.filter((_, i) => i !== index) } : form)

/** A new reference row: an SFDA product row with no code yet (not written until it has one). */
export function addReferenceRow(form: DataForm): DataForm {
  if (!form.reference) return form
  const row: ReferenceRow = { uid: nextUid(), table: 'sfda', code: '', base: null, fields: [] }
  return { ...form, reference: { ...form.reference, rows: [...form.reference.rows, row] } }
}

export const removeReferenceRow = (form: DataForm, index: number): DataForm =>
  form.reference ? { ...form, reference: { ...form.reference, rows: form.reference.rows.filter((_, i) => i !== index) } } : form

/** A new eligibility fact: a number with no key yet (not written until it has one). */
export function addFact(form: DataForm): DataForm {
  if (!form.eligibility) return form
  const fact: FactRow = { uid: nextUid(), key: '', type: 'number', value: '', unit: '', base: null }
  return { ...form, eligibility: { ...form.eligibility, facts: [...form.eligibility.facts, fact] } }
}

export const removeFact = (form: DataForm, index: number): DataForm =>
  form.eligibility ? { ...form, eligibility: { ...form.eligibility, facts: form.eligibility.facts.filter((_, i) => i !== index) } } : form

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
export function formFromText(text: string, options: FormOptions = {}): { form: DataForm } | { problem: 'invalid' | 'unshaped' } {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return { problem: 'invalid' }
  }
  if (!isObj(v)) return { problem: 'invalid' }
  const form = formFromData(v, options)
  return form ? { form } : { problem: 'unshaped' }
}
