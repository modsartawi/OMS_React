import type { PlaygroundDocument, PlaygroundEvaluateBody, PlaygroundKind } from '@/core/insurance-rules/playground'

// One experiment as the 677 page holds it: the Data box (the door's `data`, engine shape) and the Rule box (the scratch
// `document`), both JSON text. Pure. 678 adds the kind seeds (`kindSeed`); 682 the form ⇄ JSON; 687 the codec.

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

// ── The kind seeds (678) ──────────────────────────────────────────────────────────────────
// Switching the kind seeds that kind's starter: a document of that kind with one example rule (example DATA, not
// copy), and the example data. A coverage experiment's data carries the engine's `payer` block (CoveragePayer:
// the deductible the payer stated per group); its spelling is the brief's guess until 3245 / 691.

/** GUESS (691): the engine's CoveragePayer — per deductible group the payer's own percent and maximum. */
export const SEED_COVERAGE_PAYER = {
  deductibles: { G1: { percent: 20, max: 50 }, G2: { percent: 30, max: 100 }, G3: { percent: null, max: null } },
}

export const SEED_COVERAGE_DOCUMENT: PlaygroundDocument = {
  schema: 1,
  kind: 'coverage',
  revision: 0,
  fields: [],
  lists: [],
  rules: [
    {
      id: 'C-1',
      name: { en: 'One pack on a long supply', ar: 'عبوة واحدة للصرف الطويل' },
      when: [{ check: 'line', field: 'daysSupply', above: 90 }],
      then: [{ effect: 'quantityCap', value: 1 }],
    },
  ],
}

export const SEED_CATEGORY_DOCUMENT: PlaygroundDocument = {
  schema: 1,
  kind: 'category',
  revision: 0,
  fields: [],
  lists: [],
  rules: [
    {
      id: 'K-1',
      name: { en: 'Long supply counts as brand', ar: 'الصرف الطويل يحسب علامة تجارية' },
      when: [{ check: 'line', field: 'daysSupply', above: 90 }],
      then: [{ effect: 'setCategory', group: 'G2' }],
    },
  ],
}

const SEEDS: Record<PlaygroundKind, { dataText: string; documentText: string }> = {
  guard: { dataText: SEED_DATA_TEXT, documentText: SEED_DOCUMENT_TEXT },
  coverage: { dataText: pretty({ ...SEED_DATA, payer: SEED_COVERAGE_PAYER }), documentText: pretty(SEED_COVERAGE_DOCUMENT) },
  category: { dataText: SEED_DATA_TEXT, documentText: pretty(SEED_CATEGORY_DOCUMENT) },
}

/** The kind's starter boxes: its document and the example data. */
export const kindSeed = (kind: PlaygroundKind) => SEEDS[kind]

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
