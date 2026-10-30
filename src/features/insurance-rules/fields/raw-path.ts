// Raw-FHIRPath mode (oms 695; BackOffice spec 3271, 3262 V4, doors 3282 + 3296). Pure: no React, no http.
//
// The client never parses FHIRPath: every verdict below is the door's, and this module only decides what those verdicts
// mean for the Propose button. A verdict answers ONE question (the path with its message, level, type, cardinality and
// system), so each answer is kept with that question's key and counts only while the form still asks it.
//
// ⚠️ PROVISIONAL: 3282 and 3296 name these doors and spell no shape; 711 reconciles.

import type { FhirCatalogRow, FhirFactType, FhirLevel, FhirMessage } from '@/core/insurance-rules/fhir-catalog'
import { latestWins, type LatestWins } from '@/core/insurance-rules/latest-wins'
import type { Says } from '@/core/insurance-rules/model'
import { FIELD_KEY } from './field-form'

/** The quiet window after the last keystroke before Compile is asked. */
export const COMPILE_DELAY_MS = 400

/** What the form holds. `initial` of the dialog is any part of it, so an inbox or a clicked tree can open it filled. */
export interface RawPathValues {
  path: string
  moment: FhirMessage
  level: FhirLevel
  type: FhirFactType
  cardinality: 'single' | 'list'
  system: string
  key: string
  labelEn: string
  labelAr: string
  /** The tree's door called this a Patient field (697): warned, never refused. Shown here only and never sent: the flag on the proposal row is the door's own. */
  patientWarning?: boolean
}

export function rawPathForm(initial: Partial<RawPathValues> = {}): RawPathValues {
  return { path: '', moment: 'eligibility', level: 'message', type: 'text', cardinality: 'single', system: '', key: '', labelEn: '', labelAr: '', ...initial }
}

/** The question Compile and Probe answer. The key and labels are not part of it. */
export interface CompileInput {
  path: string
  moment: FhirMessage
  level: FhirLevel
  type: FhirFactType
  cardinality: 'single' | 'list'
  system: string | null
}

/** Null when there is no path to ask about. */
export function compileInput(form: RawPathValues): CompileInput | null {
  const path = form.path.trim()
  if (!path) return null
  return { path, moment: form.moment, level: form.level, type: form.type, cardinality: form.cardinality, system: form.system.trim() || null }
}

export const inputKey = (i: CompileInput): string => JSON.stringify([i.path, i.moment, i.level, i.type, i.cardinality, i.system])

/** The refusals the client has a word for (V4, W8). A code it does not know is still a refusal. */
export const RAW_PATH_REFUSALS = ['syntax', 'clockFunction', 'terminologyFunction', 'conformsTo', 'trace', 'typeMisfit', 'unlistedExtension'] as const

export interface PathRefusal {
  code: string
  /** The door's own sentence. */
  message: string
  /** The offending function or extension URL, when the door names one. */
  detail?: string | null
}

export interface PathWarning {
  code: string
  message: string
  /** `caseOnlyCode`: the code as the path spells it, and as the system does. */
  literal?: string | null
  known?: string | null
}

export interface CompileVerdict {
  refusals: PathRefusal[]
  warnings: PathWarning[]
}

export interface PayerProbe {
  payer: string
  match: number
  noMatch: number
  unknown: number
}

export interface ProbeReply {
  payers: PayerProbe[]
  refusals: PathRefusal[]
}

/** Zero matches anywhere is a warning (3282), and never stops a proposal. */
export const isZeroMatches = (r: ProbeReply): boolean => r.payers.every((p) => p.match === 0)

/** A door's reply tagged with the question it answers. A failed door has no `value`. */
export interface Answer<V> {
  key: string
  value?: V
  error?: unknown
}

/** The newest answer the door gave, however the replies arrive; the answer carries its question, so a caller can tell. */
export function answerLoop<V>(delayMs: number, door: (input: CompileInput) => Promise<V>, onAnswer: (a: Answer<V>) => void, onStart?: () => void): LatestWins<CompileInput> {
  return latestWins<CompileInput, Answer<V>>({
    delayMs,
    run: (input) => {
      const key = inputKey(input)
      return door(input).then(
        (value) => ({ key, value }),
        (error: unknown) => ({ key, error }),
      )
    },
    onStart,
    onSettle: (s) => {
      if (s.ok) onAnswer(s.value)
    },
  })
}

/** The answer only while the form still asks its question: a reply can land after the author typed again. */
export const currentAnswer = <V,>(a: Answer<V> | null, key: string | null): Answer<V> | null => (a && a.key === key ? a : null)

export type ProposeBlocker = 'pathMissing' | 'keyMissing' | 'keyInvalid' | 'keyTaken' | 'labelMissing' | 'systemMissing' | 'notChecked' | 'refused' | 'notProbed'

/**
 * What stops Propose; empty means it may be sent. Every refusal blocks, a warning and zero matches never do. A Probe of
 * this very question is required, so the author has seen who answers before proposing. The door still decides.
 */
export function proposeBlockers(form: RawPathValues, checked: Answer<CompileVerdict> | null, probed: Answer<ProbeReply> | null, catalog: readonly FhirCatalogRow[]): ProposeBlocker[] {
  const out: ProposeBlocker[] = []
  const input = compileInput(form)
  if (!input) out.push('pathMissing')
  else {
    const key = inputKey(input)
    const verdict = currentAnswer(checked, key)?.value
    const probe = currentAnswer(probed, key)?.value
    if (!verdict) out.push('notChecked')
    if (verdict?.refusals.length || probe?.refusals.length) out.push('refused')
    else if (!probe) out.push('notProbed')
  }
  const fieldKey = form.key.trim()
  if (!fieldKey) out.push('keyMissing')
  else if (!FIELD_KEY.test(fieldKey)) out.push('keyInvalid')
  else if (catalog.some((r) => r.moment === form.moment && r.level === form.level && r.key.toLowerCase() === fieldKey.toLowerCase())) out.push('keyTaken')
  if (!form.labelEn.trim() || !form.labelAr.trim()) out.push('labelMissing')
  if (form.type === 'code' && !form.system.trim()) out.push('systemMissing')
  return out
}

export interface FieldProposalBody {
  key: string
  label: Says
  moment: FhirMessage
  level: FhirLevel
  type: FhirFactType
  cardinality: 'single' | 'list'
  system: string | null
  fhirPath: string
}

export function proposalBody(form: RawPathValues): FieldProposalBody {
  return {
    key: form.key.trim(),
    label: { en: form.labelEn.trim(), ar: form.labelAr.trim() },
    moment: form.moment,
    level: form.level,
    type: form.type,
    cardinality: form.cardinality,
    system: form.system.trim() || null,
    fhirPath: form.path.trim(),
  }
}
