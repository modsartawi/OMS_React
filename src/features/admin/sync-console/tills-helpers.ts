/**
 * The Tills view's pure logic (spec 4288, BackOffice 4290). No React, no network: pinned by `tills-helpers.test.ts`.
 *
 * 🚩 **The verdict is the till's.** Each till judges its own links over a rolling window and reports the result; the
 * console only names and colours it. The one thing decided here is **silence**: a till that stopped reporting is never
 * drawn with its last verdict as if it were current — a stale last-seen beats an old "online".
 *
 * Every time is judged against the door's `asOf` (the server's clock), never the browser's.
 */
import type { Severity } from '@/core/ui/severity'
import type { LinkState, LinkVerdict, Till } from '@/core/models/sync-console'
import { codeBadge } from './helpers'

/**
 * A till reports with its presence stamp, about once a minute; one missed beat is noise, three is silence. Past this, a
 * verdict is history, not news.
 */
export const TILL_SILENT_AFTER_MS = 3 * 60_000

const LINK_SEVERITY: Record<LinkState, Severity> = {
  online: 'ok',
  unstable: 'warn',
  offline: 'bad',
  unknown: 'mute',
  local: 'mute',
}

/** The dot beside a cell's words, one token class per severity (the palette lint refuses literals). */
export const LINK_DOT: Record<Severity, string> = {
  ok: 'bg-success',
  go: 'bg-primary',
  warn: 'bg-attention',
  bad: 'bg-danger',
  mute: 'bg-muted-foreground/40',
}

export type TillLinkFigures = { failPct: number | null; slowPct: number | null; p95Ms: number | null }

/**
 * One link cell:
 * - `verdict` — the till's current judgement (`labelKey` null for a state this bundle does not know: show the code);
 * - `silent` — the till stopped reporting; `state` is the last verdict it sent, for the sub-line only;
 * - `noData` — the link was never reported (an older build, or the store link before 4291).
 *
 * `noteKey` explains a cell whose word alone would puzzle L1: a **local** store link (BackOffice 4291) is the main
 * till's — the store database is on that till, so there is no store network to check, and the cell says so rather
 * than leaving a grey "Local" to be read as "no data".
 */
export type TillLinkCell = {
  kind: 'verdict' | 'silent' | 'noData'
  labelKey: string | null
  sev: Severity
  state: LinkState | null
  figures: TillLinkFigures | null
  since: string | null
  noteKey: string | null
}

/** A wire time (`yyyy-MM-ddTHH:mm:ss`, local, no offset) as ms, or `null` when absent or unreadable. */
function wireMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Older than the silence window against `asOf` — or absent, which is never "fresh". */
function isOld(value: string | null, asOf: string): boolean {
  const ms = wireMs(value)
  const now = wireMs(asOf)
  if (ms == null || now == null) return true
  return now - ms > TILL_SILENT_AFTER_MS
}

/** The till has not stamped presence within the window (or never did): it may be off, or its WAN down. */
export function tillSilent(till: Pick<Till, 'lastSeenAt'>, asOf: string): boolean {
  return isOld(till.lastSeenAt, asOf)
}

/** What one link cell of `till` says, as of the door's `asOf`. */
export function tillLinkCell(link: LinkVerdict | null, till: Pick<Till, 'lastSeenAt' | 'reportedAt'>, asOf: string): TillLinkCell {
  if (!link)
    return { kind: 'noData', labelKey: 'tills.states.noData', sev: 'mute', state: null, figures: null, since: null, noteKey: null }

  const figures =
    link.state === 'local' || (link.failPct == null && link.slowPct == null && link.p95Ms == null)
      ? null
      : { failPct: link.failPct, slowPct: link.slowPct, p95Ms: link.p95Ms }

  if (tillSilent(till, asOf) || isOld(till.reportedAt, asOf))
    return { kind: 'silent', labelKey: 'tills.states.silent', sev: 'mute', state: link.state, figures, since: link.since, noteKey: null }

  const badge = codeBadge(LINK_SEVERITY, 'tills.states', link.state)
  const noteKey = link.state === 'local' ? 'tills.localNote' : null
  return { kind: 'verdict', labelKey: badge.labelKey, sev: badge.sev, state: link.state, figures, since: link.since, noteKey }
}
