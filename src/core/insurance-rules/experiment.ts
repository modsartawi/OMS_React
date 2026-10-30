import { PLAYGROUND_KINDS, type PlaygroundEvaluateBody, type PlaygroundKind } from './playground'

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
