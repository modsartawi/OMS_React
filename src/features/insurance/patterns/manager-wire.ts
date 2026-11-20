/**
 * The manager's pattern doors' answers, read FIELD BY FIELD (oms 924; reconciled with BackOffice 4055 as built), the way
 * 922's `./wire` reads the case doors: nothing is spread from the wire, so a field nobody agreed to — above all a
 * patient's identity, should a server ever send one — never reaches the query cache, the screen or a log. Missing lists
 * read as empty, a missing number as null.
 *
 * The wire is BackOffice's: a setting is `{ key, value, defaultValue, min, max, wholeNumber, updatedBy, updatedAt }`, a
 * change `{ key, oldValue, newValue, changedBy, changedAt }`, the reveal log `{ page, pageSize, total, rows }` of
 * `{ caseNumber, revealedBy, revealedAt, reason, fieldsShown }`.
 *
 * Its own small readers (not `./wire`'s, which keeps them private): spec 4050's parallel slices never edit one file.
 */
import type { PatternReveal, PatternRevealsPage, PatternSetting, PatternSettingChange, PatternSettings } from '@/core/models/insurance-pattern-manager'

type Raw = Record<string, unknown>

const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const list = <T>(v: unknown, read: (raw: Raw) => T): T[] => (Array.isArray(v) ? v.filter(isRaw).map(read) : [])

/**
 * A threshold: its key and value. The server's `defaultValue`, `min`, `max` and `wholeNumber` are NOT read — the page's
 * one ranges table rules (the same ranges) — nor its `updatedBy` / `updatedAt` (the change log says who and when).
 */
const readSetting = (r: Raw): PatternSetting => ({ name: str(r.key), value: numOrNull(r.value) })

const readChange = (r: Raw): PatternSettingChange => ({
  name: str(r.key),
  oldValue: numOrNull(r.oldValue),
  newValue: numOrNull(r.newValue),
  by: str(r.changedBy),
  at: str(r.changedAt),
})

/** `GET` / `PUT InsuranceRules/Patterns/Settings`. An answer that is not an object reads as no thresholds and no changes. */
export function readSettings(raw: unknown): PatternSettings {
  if (!isRaw(raw)) return { settings: [], changes: [] }
  return { settings: list(raw.settings, readSetting), changes: list(raw.changes, readChange) }
}

/**
 * One row of the reveal log: which case, who, when and why — and nothing else. 🔒 The revealed identity is never read
 * (BackOffice 4055: the log "never returns the revealed identity"), so even a server that sent it would have it dropped
 * here, before the cache. Its `fieldsShown` (the NAMES of the fields shown, not their values) is not read either.
 */
const readReveal = (r: Raw): PatternReveal => ({ caseNumber: str(r.caseNumber), by: str(r.revealedBy), at: str(r.revealedAt), reason: str(r.reason) })

/** `GET InsuranceRules/Patterns/Reveals`: `{ page, pageSize, total, rows }`. An answer that is not an object reads as an empty log. */
export function readRevealsPage(raw: unknown): PatternRevealsPage {
  if (!isRaw(raw)) return { items: [], totalMatches: 0 }
  return { items: list(raw.rows, readReveal), totalMatches: num(raw.total) }
}
