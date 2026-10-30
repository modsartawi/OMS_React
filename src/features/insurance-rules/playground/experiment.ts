import { EXAMPLE_COVERAGE_PAYER, EXAMPLE_DATA } from '@/core/insurance-rules/example-data'
import type { PlaygroundDocument, PlaygroundEvaluateBody, PlaygroundKind } from '@/core/insurance-rules/playground'

// One experiment as the 677 page holds it: the Data box (the door's `data`, engine shape) and the Rule box (the scratch
// `document`), both JSON text. Pure. 678 adds the kind seeds (`kindSeed`); 682 the form ⇄ JSON; 687 the codec.

/** The box a problem is in. */
export type ExperimentBox = 'data' | 'document'

/**
 * The seeded data: one nphies request with one line of 120 days' supply — core's example dataset (688 graduated it, so
 * "Open in playground" on the rule screens seeds the same data).
 */
export const SEED_DATA = EXAMPLE_DATA

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

/** GUESS (691): the engine's CoveragePayer (now in core, 688). */
export const SEED_COVERAGE_PAYER = EXAMPLE_COVERAGE_PAYER

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

/**
 * The Data pane's tab: **Form** and **JSON** (682: two views of ONE dataset, the data box, sent as `data`) or **Raw**
 * (free text, sent as `raw` as it is; 684). Raw keeps its own text: leaving Raw never overwrites the data box.
 */
export type DataTab = 'form' | 'json' | 'raw'

/** The Data pane's tabs, in the order they are drawn. */
export const DATA_TABS: readonly DataTab[] = ['form', 'json', 'raw']

/**
 * The boxes → the door's body, or which box does not hold a JSON object (then nothing is sent). Exactly one of
 * `data` | `raw`: the Raw tab sends its text even when it is not JSON (the door says so) and does not read the data box.
 */
export function evaluateBody(x: { dataText: string; documentText: string; asOf: string; kind?: PlaygroundKind; dataTab?: DataTab; rawText?: string }): {
  body: PlaygroundEvaluateBody | null
  problems: ExperimentBox[]
} {
  const raw = x.dataTab === 'raw'
  const data = raw ? null : parseObject(x.dataText)
  const document = parseObject(x.documentText)
  const problems: ExperimentBox[] = []
  if (data && !data.ok) problems.push('data')
  if (!document.ok) problems.push('document')
  if (problems.length || !document.ok) return { body: null, problems }
  const kind = x.kind ?? 'guard'
  if (raw) return { body: { kind, raw: x.rawText ?? '', document: document.value, asOf: x.asOf }, problems }
  return { body: { kind, data: data?.ok ? data.value : undefined, document: document.value, asOf: x.asOf }, problems }
}
