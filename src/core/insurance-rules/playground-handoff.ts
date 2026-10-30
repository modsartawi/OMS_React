import { experimentFile, readExperiment, type PlaygroundExperiment } from './experiment'
import { INSURANCE_RULES_PATH } from './model'
import { PLAYGROUND_KINDS, type PlaygroundKind } from './playground'

// "Open in playground" (BackOffice spec 3243 stories 30, 31; oms ticket 688): how a rule screen hands a COPY of its rule
// to the playground without importing it. The experiment travels in router state; a short-lived per-tab storage
// fallback keeps it across a reload. Only a link that asked for a copy (`?open=copy`) reads the fallback, so a later
// visit from the menu never re-opens an old copy. Pure but for the storage passed in (every access try/catch).

export const PLAYGROUND_PATH = `${INSURANCE_RULES_PATH}/playground`
export const PLAYGROUND_COPY_SEARCH = '?open=copy'
export const PLAYGROUND_COPY_PATH = `${PLAYGROUND_PATH}${PLAYGROUND_COPY_SEARCH}`
/** 🚩 Decision (overrulable): the reload fallback lasts 30 minutes. */
export const HANDOFF_TTL_MS = 30 * 60 * 1000
const KEY = 'oms.insurance-playground.handoff.v1'

/** The copy and the rule it was copied from (the playground says so). */
export interface PlaygroundHandoff {
  experiment: PlaygroundExperiment
  from: { kind: PlaygroundKind; ruleId: string }
}

type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The router state a rule screen navigates with. */
export const handoffState = (h: PlaygroundHandoff) => ({ playgroundCopy: { file: experimentFile(h.experiment), from: h.from } })

function handoffIn(v: unknown): PlaygroundHandoff | null {
  if (!isRecord(v) || !isRecord(v.from)) return null
  const read = readExperiment(v.file)
  const kind = PLAYGROUND_KINDS.find((k) => k === (v.from as Record<string, unknown>).kind)
  const ruleId = v.from.ruleId
  if (!read.ok || !kind || typeof ruleId !== 'string') return null
  return { experiment: read.experiment, from: { kind, ruleId } }
}

/** Keep the copy for a reload (per tab). Storage off: the copy still travels in router state. */
export function stashHandoff(h: PlaygroundHandoff, now: number, store: KeyStore | null = sessionStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify({ at: now, ...handoffState(h).playgroundCopy }))
  } catch {
    // storage off or full: router state alone
  }
}

/** The copy, from router state, else (on a copy link) from a fresh stash; else null. */
export function readHandoff(state: unknown, search: string, now: number, store: KeyStore | null = sessionStore()): PlaygroundHandoff | null {
  const fromState = isRecord(state) ? handoffIn(state.playgroundCopy) : null
  if (fromState) return fromState
  if (!new URLSearchParams(search).has('open', 'copy')) return null
  try {
    const raw = store?.getItem(KEY)
    if (!raw) return null
    const v: unknown = JSON.parse(raw)
    if (!isRecord(v) || typeof v.at !== 'number' || now - v.at > HANDOFF_TTL_MS || now < v.at) return null
    return handoffIn(v)
  } catch {
    return null
  }
}

function sessionStore(): KeyStore | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}
