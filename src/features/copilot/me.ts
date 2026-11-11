import type {
  CopilotKeptBy,
  CopilotKeptReading,
  CopilotKnowsMe,
  CopilotKnowsMeLimits,
  CopilotNamedSet,
  CopilotOwnReadingKind,
  CopilotReadingChoice,
  CopilotSetMember,
  CopilotEditSetRequest,
} from '@/core/models/copilot'
import type { AnalyticsLabel } from '@/core/models/analytics'
import { OWN_READING_KINDS } from './rules'

/**
 * The page "What the copilot knows about me" — its pure seam (ticket 894, BackOffice spec 3633 R25/R28/R29, door 3689).
 * The wire is read defensively into the page's model; the screen is `CopilotMePage`, the doors `./me-api`.
 */

/** The page as drawn: the server's payload, readings in kind order, and whether there is anything at all. */
export interface MePage extends CopilotKnowsMe {
  empty: boolean
}

/** 3689's own limits, should the server not say. */
const LIMITS: CopilotKnowsMeLimits = { maxSets: 10, maxMembers: 200, maxName: 40 }

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const labelOf = (v: unknown, fallback: string): AnalyticsLabel => {
  const l = (v ?? {}) as Partial<AnalyticsLabel>
  const en = str(l.en)
  const ar = str(l.ar)
  return en || ar ? { en: en || ar, ar } : { en: fallback, ar: '' }
}
const keptByOf = (v: unknown): CopilotKeptBy => (v === 'offer' || v === 'direct' ? v : 'page')
const isKind = (v: unknown): v is CopilotOwnReadingKind => (OWN_READING_KINDS as readonly unknown[]).includes(v)
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const positive = (v: unknown, d: number): number => (typeof v === 'number' && v > 0 ? v : d)

function choiceOf(w: unknown): CopilotReadingChoice | null {
  const c = (w ?? {}) as Partial<CopilotReadingChoice>
  const value = str(c.value)
  return value ? { value, label: labelOf(c.label, value) } : null
}

/** One kept reading; null when its kind is not one the page knows. */
export function readingOf(w: unknown): CopilotKeptReading | null {
  const r = (w ?? {}) as Partial<CopilotKeptReading>
  if (!isKind(r.kind)) return null
  const value = str(r.value)
  return {
    kind: r.kind,
    value,
    label: labelOf(r.label, value),
    unused: r.unused === true,
    choices: list(r.choices).map(choiceOf).filter((c): c is CopilotReadingChoice => c !== null),
    keptAt: str(r.keptAt),
    keptBy: keptByOf(r.keptBy),
  }
}

export function memberOf(w: unknown): CopilotSetMember | null {
  const m = (w ?? {}) as Partial<CopilotSetMember>
  const key = str(m.key)
  return key ? { key, kind: str(m.kind), label: labelOf(m.label, key), gone: m.gone === true } : null
}

/** One named set; its gone count is the wire's, or its members' when the wire does not say. */
export function setOf(w: unknown): CopilotNamedSet | null {
  const s = (w ?? {}) as Partial<CopilotNamedSet>
  const setId = str(s.setId)
  if (!setId) return null
  const members = list(s.members).map(memberOf).filter((m): m is CopilotSetMember => m !== null)
  return {
    setId,
    name: str(s.name),
    kind: str(s.kind),
    members,
    gone: typeof s.gone === 'number' ? s.gone : members.filter((m) => m.gone).length,
    keptAt: str(s.keptAt),
    keptBy: keptByOf(s.keptBy),
  }
}

const byKind = (a: CopilotKeptReading, b: CopilotKeptReading) => OWN_READING_KINDS.indexOf(a.kind) - OWN_READING_KINDS.indexOf(b.kind)

const page = (readings: CopilotKeptReading[], sets: CopilotNamedSet[], limits: CopilotKnowsMeLimits, canChange: boolean): MePage => ({
  readings: [...readings].sort(byKind),
  sets,
  limits,
  canChange,
  empty: readings.length === 0 && sets.length === 0,
})

/** The page after a change: the readings back in kind order, and `empty` following. */
export const withPage = (p: MePage, change: Partial<Pick<MePage, 'readings' | 'sets'>>): MePage =>
  page(change.readings ?? p.readings, change.sets ?? p.sets, p.limits, p.canChange)

/** `GET Copilot/Me`'s payload as the page draws it. A reply that is not one reads as an empty page. */
export function fromMeWire(w: unknown): MePage {
  const v = (w ?? {}) as Partial<CopilotKnowsMe>
  const l = (v.limits ?? {}) as Partial<CopilotKnowsMeLimits>
  return page(
    list(v.readings).map(readingOf).filter((r): r is CopilotKeptReading => r !== null),
    list(v.sets).map(setOf).filter((s): s is CopilotNamedSet => s !== null),
    { maxSets: positive(l.maxSets, LIMITS.maxSets), maxMembers: positive(l.maxMembers, LIMITS.maxMembers), maxName: positive(l.maxName, LIMITS.maxName) },
    // Only a plain false refuses changes: a door from before the review answered only with own readings applying.
    v.canChange !== false,
  )
}

/** The name lookup's own limit: `COPILOT-433` past it. */
export const LOOKUP_MAX = 100

/** A lookup is sent only with something to look up, at most 100 characters. */
export const lookupFits = (text: string): boolean => text.trim() !== '' && text.length <= LOOKUP_MAX

/** A member edit, ready to send, or why the page will not send it. */
export type SetEdit =
  | { ok: true; request: CopilotEditSetRequest }
  | { ok: false; why: 'already' | 'kind' | 'full' | 'last' }

/** The members still in the store master / channel list: a gone one must be left out of any edit (3689). */
const liveKeys = (set: CopilotNamedSet): string[] => set.members.filter((m) => !m.gone).map((m) => m.key)

/** Add a lookup match: the live keys, then the match. One kind to a set, no member twice, at most `maxMembers`. */
export function addMember(set: CopilotNamedSet, match: CopilotSetMember, maxMembers: number): SetEdit {
  const keys = liveKeys(set)
  if (set.members.some((m) => m.key === match.key)) return { ok: false, why: 'already' }
  if (set.kind && match.kind !== set.kind) return { ok: false, why: 'kind' }
  if (keys.length >= maxMembers) return { ok: false, why: 'full' }
  return { ok: true, request: { setId: set.setId, members: [...keys, match.key] } }
}

/** Remove one member: the live keys without it. The last live member is not removed: the set is deleted instead. */
export function removeMember(set: CopilotNamedSet, key: string): SetEdit {
  const keys = liveKeys(set).filter((k) => k !== key)
  if (keys.length === 0) return { ok: false, why: 'last' }
  return { ok: true, request: { setId: set.setId, members: keys } }
}
