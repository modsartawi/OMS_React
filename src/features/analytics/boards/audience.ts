import type { AnalyticsAudience, AnalyticsAudienceCandidates, AnalyticsAudienceRole, AnalyticsAudienceUser, AnalyticsAudienceWrite, AnalyticsItem, AnalyticsLabel } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { formatCount } from '@/core/util/bidi'

/**
 * A Shared item's audience (spec 819 §C/§E, ticket 826), pure: the chip's words, and what the share dialog may
 * write. Membership is the store's to resolve through authz; the web only names who the item is shared with.
 */

/** The chip names at most this many entries; past it, it counts them (`n / m`). */
export const CHIP_NAMES = 3

export interface AudienceName {
  kind: 'role' | 'user'
  /** A role's key or a user's id. */
  key: string
  /** A role's words in the language, or a user's name; the key when it has none. */
  text: string
  /** A role authz deleted: kept in the audience, marked, granting nobody. */
  removed: boolean
}

export type AudienceSummary = { everyone: true } | { everyone: false; names: AudienceName[]; count: string | null }

/**
 * The audience chip's text: everyone, or the roles then the users, at most `CHIP_NAMES` of them; when some are not
 * named, `count` is "named / all" as ONE string (`formatCount`, isolated once by the caller).
 */
export function audienceSummary(audience: AnalyticsAudience, lang: string): AudienceSummary {
  if (audience.everyone) return { everyone: true }
  const all: AudienceName[] = [
    ...audience.roles.map((r) => ({ kind: 'role' as const, key: r.key, text: saysIn(r.label, lang) || r.key, removed: r.removed })),
    ...audience.users.map((u) => ({ kind: 'user' as const, key: u.id, text: u.name || u.id, removed: false })),
  ]
  const names = all.slice(0, CHIP_NAMES)
  return { everyone: false, names, count: names.length < all.length ? formatCount(names.length, all.length) : null }
}

/** The audience a chip shows: a Shared item's own, or everyone (v1's share) when it has none; none off Shared. */
export function audienceOf(item: Pick<AnalyticsItem, 'tier' | 'audience'>): AnalyticsAudience | null {
  if (item.tier !== 'shared') return null
  return item.audience ?? { everyone: true }
}

/** The share dialog's working copy: everyone, or the chosen role keys and user ids (in the order chosen). */
export interface AudienceDraft {
  everyone: boolean
  roles: string[]
  users: string[]
}

/** The dialog opens on the item's audience, or on everyone (v1's share) for an item not yet shared. */
export function audienceDraft(audience: AnalyticsAudience | null | undefined): AudienceDraft {
  if (!audience || audience.everyone) return { everyone: true, roles: [], users: [] }
  return { everyone: false, roles: audience.roles.map((r) => r.key), users: audience.users.map((u) => u.id) }
}

/** What Share and the Audience door carry; `null` for an empty choice, which shares with nobody (that is Unshare). */
export function audienceWrite(draft: AudienceDraft): AnalyticsAudienceWrite | null {
  if (draft.everyone) return { everyone: true }
  if (draft.roles.length + draft.users.length === 0) return null
  return { roles: [...draft.roles], users: [...draft.users] }
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * §C: a curator who does not own a Shared item may only NARROW its audience: from everyone to any choice, or from a
 * choice to a strict part of it. Widening, keeping it as it is, and emptying it (that is Unshare) are not narrowing.
 */
export function isNarrowing(before: AudienceDraft, after: AudienceDraft): boolean {
  if (!audienceWrite(after) || after.everyone) return false
  if (before.everyone) return true
  const within = after.roles.every((r) => before.roles.includes(r)) && after.users.every((u) => before.users.includes(u))
  return within && !(sameSet(before.roles, after.roles) && sameSet(before.users, after.users))
}

// ── The proposed wire (BackOffice 3378), read defensively: kept here beside its one reader, like `./revisions`. ──
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const words = (v: unknown): AnalyticsLabel => (typeof v === 'string' ? { en: v, ar: v } : { en: text(rec(v).en), ar: text(rec(v).ar) })

/** A role; the server (3408 §B) names it by `name` and labels it with one string, read in both languages. */
function readRole(v: unknown): AnalyticsAudienceRole {
  if (typeof v === 'string') return { key: v, label: { en: '', ar: '' }, removed: false }
  const r = rec(v)
  return { key: text(r.key) || text(r.name), label: words(r.label), removed: r.removed === true }
}
/** A user (a bare id reads as itself). 833: a report's candidates also carry `email`, `canRun` and `inAudience`, kept only when sent. */
export function readUser(v: unknown): AnalyticsAudienceUser {
  if (typeof v === 'string') return { id: v, name: '', employeeId: '' }
  const u = rec(v)
  return {
    id: text(u.id),
    name: text(u.name),
    employeeId: text(u.employeeId),
    ...(typeof u.email === 'string' ? { email: u.email } : {}),
    ...(typeof u.canRun === 'boolean' ? { canRun: u.canRun } : {}),
    ...(typeof u.inAudience === 'boolean' ? { inAudience: u.inAudience } : {}),
  }
}

/** An item's `audience`: `{ everyone: true }`, or roles and users (a bare key reads as itself); absent stays absent. */
export function readAudience(raw: unknown): AnalyticsAudience | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const a = rec(raw)
  if (a.everyone === true) return { everyone: true }
  return { everyone: false, roles: list(a.roles).map(readRole).filter((r) => r.key), users: list(a.users).map(readUser).filter((u) => u.id) }
}

/**
 * `GET Analytics/AudienceCandidates` — the server (3408 §B) answers one flat list of `{ kind: role | user, … }`,
 * split here by kind; a `{ roles, users }` object reads too. Each list is empty when absent.
 */
export function readCandidates(raw: unknown): AnalyticsAudienceCandidates {
  if (Array.isArray(raw)) {
    const of = (kind: string) => raw.filter((m) => rec(m).kind === kind)
    return { roles: of('role').map(readRole).filter((r) => r.key), users: of('user').map(readUser).filter((u) => u.id) }
  }
  const c = rec(raw)
  return { roles: list(c.roles).map(readRole).filter((r) => r.key), users: list(c.users).map(readUser).filter((u) => u.id) }
}
