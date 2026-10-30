import { PLAYGROUND_KINDS, type PlaygroundEvaluateBody, type PlaygroundKind } from './playground'
import { exampleData } from './example-data'

// The rule playground's experiment and its versioned codec (BackOffice spec 3243 stories 49, 50; oms ticket 687).
// One shape for every place an experiment travels: an exported `.json` file, the playground's browser storage,
// "Open in playground" (688, which builds one on the guard / coverage / category screens) and the lessons (689).
//
// In `core` (not the playground feature) because 688 and 689 build experiments without importing the feature.
// Pure: no React, no storage, no DOM. 🚩 Decision (overrulable): the file format is versioned from v1; a file of a
// version this playground does not know is refused, never read "as best we can".

/** The file's own marker, so a random JSON object with a `version` is not mistaken for an experiment. */
export const EXPERIMENT_FORMAT = 'oms.insurance-playground.experiment'
/** The one version this playground reads and writes. A newer playground bumps it and keeps reading this one. */
export const EXPERIMENT_VERSION = 1

/**
 * One experiment: a name, the kind, the "as of", the scratch mini-ruleset `document` (engine spelling), and the data
 * — exactly one of `data` (the engine shape, an object) or `raw` (the Raw tab's text, kept as it is; 684).
 */
export interface PlaygroundExperiment {
  name: string
  kind: PlaygroundKind
  /** Local wall-clock, `yyyy-MM-ddTHH:mm:ss`, no `Z` (as the door takes it). */
  asOf: string
  document: unknown
  data?: unknown
  raw?: string
}

/** Why a file (or a stored entry) was not read. Each is said in words by the page. */
export const EXPERIMENT_REFUSALS = ['malformed', 'notExperiment', 'noVersion', 'unknownVersion', 'newerVersion', 'invalid'] as const
export type ExperimentRefusal = (typeof EXPERIMENT_REFUSALS)[number]

export type ExperimentDecode = { ok: true; experiment: PlaygroundExperiment } | { ok: false; code: ExperimentRefusal }

/** A name is trimmed and capped (the name box's cap). */
export const EXPERIMENT_NAME_MAX = 80

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const AS_OF = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

/** The experiment as the v1 file holds it (also what browser storage keeps per entry). */
export function experimentFile(e: PlaygroundExperiment): Record<string, unknown> {
  const head = { format: EXPERIMENT_FORMAT, version: EXPERIMENT_VERSION, name: e.name, kind: e.kind, asOf: e.asOf }
  return e.raw !== undefined ? { ...head, raw: e.raw, document: e.document } : { ...head, data: e.data, document: e.document }
}

/** The `.json` file's text. */
export const encodeExperiment = (e: PlaygroundExperiment): string => `${JSON.stringify(experimentFile(e), null, 2)}\n`

/** A parsed value → the experiment, or why not. Never throws, never returns half an experiment. */
export function readExperiment(v: unknown): ExperimentDecode {
  if (!isRecord(v) || v.format !== EXPERIMENT_FORMAT) return { ok: false, code: 'notExperiment' }
  if (!('version' in v)) return { ok: false, code: 'noVersion' }
  const version = v.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { ok: false, code: 'unknownVersion' }
  if (version > EXPERIMENT_VERSION) return { ok: false, code: 'newerVersion' }

  const name = typeof v.name === 'string' ? v.name.trim() : ''
  const kind = PLAYGROUND_KINDS.find((k) => k === v.kind)
  const hasData = 'data' in v && v.data !== undefined
  const hasRaw = 'raw' in v && v.raw !== undefined
  const fine =
    name !== '' &&
    name.length <= EXPERIMENT_NAME_MAX &&
    kind !== undefined &&
    typeof v.asOf === 'string' &&
    AS_OF.test(v.asOf) &&
    isRecord(v.document) &&
    hasData !== hasRaw &&
    (hasData ? isRecord(v.data) : typeof v.raw === 'string')
  if (!fine || !kind) return { ok: false, code: 'invalid' }
  const head = { name, kind, asOf: v.asOf as string }
  return { ok: true, experiment: hasRaw ? { ...head, raw: v.raw as string, document: v.document } : { ...head, data: v.data, document: v.document } }
}

/** A file's text → the experiment, or why not. */
export function decodeExperiment(text: string): ExperimentDecode {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return { ok: false, code: 'malformed' }
  }
  return readExperiment(v)
}

/** The experiment → the Evaluate body (exactly one of `data` | `raw`). */
export function experimentBody(e: PlaygroundExperiment): PlaygroundEvaluateBody {
  return e.raw !== undefined
    ? { kind: e.kind, raw: e.raw, document: e.document, asOf: e.asOf }
    : { kind: e.kind, data: e.data, document: e.document, asOf: e.asOf }
}

/** `<name>.json`, the characters a file name cannot hold (Windows' set and control characters) replaced by `-`. */
export function experimentFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return `${name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')}.json`
}

/** The Evaluate body and a name → the experiment (the page saves and exports what it would send). */
export function experimentFromBody(name: string, body: PlaygroundEvaluateBody): PlaygroundExperiment {
  const head = { name: name.trim(), kind: body.kind, asOf: body.asOf }
  return body.raw !== undefined ? { ...head, raw: body.raw, document: body.document } : { ...head, data: body.data, document: body.document }
}

// ── "Open in playground" (688) ───────────────────────────────────────────────────────────────────

/** A real rule as its screen holds it, in the ENGINE's spelling (`guardRuleOut` / `otherRuleOut`), and its document. */
export interface RuleSource {
  kind: PlaygroundKind
  rule: unknown
  /** The source document (engine spelling): only its `lists` and `fields` are read. */
  document: unknown
}

const LIST_MATCH = /^list:(.+)$/
const AUDIENCE_LISTS = ['excludePatientLists', 'excludePolicyLists', 'excludeClassLists'] as const

/** Every list id a rule's blocks and audience name: `match: list:<id>`, any `inList`, a supply's per-list days. */
function listIdsNamed(rule: Record<string, unknown>): string[] {
  const out: string[] = []
  const add = (id: unknown) => typeof id === 'string' && id && !out.includes(id) && out.push(id)
  const walk = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return
    for (const c of blocks) {
      if (!isRecord(c)) continue
      if (typeof c.match === 'string') add(LIST_MATCH.exec(c.match)?.[1])
      add(c.inList)
      if (Array.isArray(c.eligibleDaysBeforeDueFor)) for (const x of c.eligibleDaysBeforeDueFor) if (isRecord(x)) add(x.list)
      walk(c.conditions)
    }
  }
  walk(rule.when)
  if (isRecord(rule.audience)) for (const k of AUDIENCE_LISTS) if (Array.isArray(rule.audience[k])) (rule.audience[k] as unknown[]).forEach(add)
  return out
}

/** Every string anywhere in a value (a formula's operator-first JSON, a block's `field`). */
function stringsIn(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof v === 'string') out.add(v)
  else if (Array.isArray(v)) v.forEach((x) => stringsIn(x, out))
  else if (isRecord(v)) Object.values(v).forEach((x) => stringsIn(x, out))
  return out
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A real rule → a NEW experiment of its kind: a one-rule document (`revision: 0`) carrying exactly the document lists
 * the rule names — and the lists those pull in through `include` / `exclude`, which the engine needs to resolve them —
 * in the document's order, the declared `fields` the rule reads (a block's `field: Key`, or `field.Key` in a formula,
 * ADR 0117), the kind's example data and `asOf`. Its name is the rule's id. Pure, and a COPY: nothing is shared with
 * the source, so editing the experiment can never change the rule. A list or team list the document does not hold
 * (a patient / policy / class list lives in its own door) is simply not carried.
 */
export function experimentFromRule(src: RuleSource, asOf: string): PlaygroundExperiment {
  const rule: Record<string, unknown> = isRecord(src.rule) ? structuredClone(src.rule) : {}
  const doc = isRecord(src.document) ? src.document : {}
  const docLists = (Array.isArray(doc.lists) ? doc.lists : []).filter(isRecord)
  const byId = new Map(docLists.map((l) => [String(l.id), l]))

  const wanted = new Set<string>()
  const pull = (id: string) => {
    const l = byId.get(id)
    if (!l || wanted.has(id)) return
    wanted.add(id)
    for (const k of ['include', 'exclude'] as const) if (Array.isArray(l[k])) for (const x of l[k] as unknown[]) if (typeof x === 'string') pull(x)
  }
  listIdsNamed(rule).forEach(pull)
  const lists = docLists.filter((l) => wanted.has(String(l.id))).map((l) => structuredClone(l))

  const read = stringsIn(rule)
  const said = [...read]
  const fields = (Array.isArray(doc.fields) ? doc.fields : [])
    .filter(isRecord)
    .filter((f) => {
      if (typeof f.key !== 'string' || !f.key) return false
      if (read.has(f.key)) return true
      const re = new RegExp(`(^|[.$])field\\.${escapeRe(f.key)}($|[^A-Za-z0-9_])`)
      return said.some((s) => re.test(s))
    })
    .map((f) => structuredClone(f))

  const name = (typeof rule.id === 'string' && rule.id.trim() ? rule.id.trim() : src.kind).slice(0, EXPERIMENT_NAME_MAX)
  return {
    name,
    kind: src.kind,
    asOf,
    document: { schema: 1, kind: src.kind, revision: 0, fields, lists, rules: [rule] },
    data: exampleData(src.kind),
  }
}
