import type { PlaygroundDocument, PlaygroundEvaluateBody, PlaygroundKind } from '@/core/insurance-rules/playground'

// One experiment as the 677 page holds it: the Data box (the door's `data`, engine shape) and the Rule box (the scratch
// `document`), both JSON text. Pure. 678 adds the kind picker and "as of"; 682 the form ⇄ JSON; 687 the codec.

/** The box a problem is in. */
export type ExperimentBox = 'data' | 'document'

/**
 * The seeded data: one nphies request with one line of 120 days' supply. The values are an EXAMPLE dataset the user
 * edits (data, not copy), so they are not translated.
 */
export const SEED_DATA = {
  request: { channel: 'nphies', store: 'P001', payer: '0001100041', policy: null, class: null, pharmacist: null, attributes: {} },
  patient: { birthDate: '1990-04-01', gender: 'male', idType: 'nationalId', attributes: {} },
  lines: [{ line: 1, item: '200021', quantity: 2, unit: 'PC', daysSupply: 120, icd: ['E11'], price: 120.5, eCode: null, dCode: null, sfdaCode: null, idfPriority: null, attributes: {} }],
  history: [],
  reference: {},
  eligibility: {},
}

/** The seeded mini-ruleset: one guard rule, "days supply above 90", in the engine's spelling. Its name is example data. */
export const SEED_DOCUMENT: PlaygroundDocument = {
  schema: 1,
  kind: 'guard',
  revision: 0,
  fields: [],
  lists: [],
  rules: [
    {
      id: 'G-1',
      name: { en: 'Long supply', ar: 'صرف لمدة طويلة' },
      onUnknown: 'none',
      when: [{ check: 'line', field: 'daysSupply', above: 90 }],
      then: [{ effect: 'guard', severity: 'WARN', says: { en: 'More than 90 days of supply', ar: 'أكثر من 90 يوماً من الصرف' } }],
    },
  ],
}

const pretty = (v: unknown) => JSON.stringify(v, null, 2)
export const SEED_DATA_TEXT = pretty(SEED_DATA)
export const SEED_DOCUMENT_TEXT = pretty(SEED_DOCUMENT)

const parseObject = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    const v: unknown = JSON.parse(text)
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? { ok: true, value: v } : { ok: false }
  } catch {
    return { ok: false }
  }
}

/** The two boxes → the door's body, or which box does not hold a JSON object (then nothing is sent). */
export function evaluateBody(x: { dataText: string; documentText: string; asOf: string; kind?: PlaygroundKind }): {
  body: PlaygroundEvaluateBody | null
  problems: ExperimentBox[]
} {
  const data = parseObject(x.dataText)
  const document = parseObject(x.documentText)
  const problems: ExperimentBox[] = []
  if (!data.ok) problems.push('data')
  if (!document.ok) problems.push('document')
  if (!data.ok || !document.ok) return { body: null, problems }
  return { body: { kind: x.kind ?? 'guard', data: data.value, document: document.value, asOf: x.asOf }, problems }
}
