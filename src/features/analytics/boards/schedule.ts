import { ApiError, apiErrorCode, apiErrorData } from '@/core/api'
import type {
  AnalyticsAudienceUser,
  AnalyticsItem,
  AnalyticsReportRun,
  AnalyticsRunOutcome,
  AnalyticsRunTrigger,
  AnalyticsSchedule,
  AnalyticsScheduleCadence,
  ParamValue,
  Weekday,
} from '@/core/models/analytics'
import { fsi } from '@/core/util/bidi'
import { readUser } from './audience'

/**
 * A report's schedules (spec 819 §C/§E, ticket 833; research 803), pure: the sentence a cadence reads as, and who
 * the editor may offer as a recipient.
 */

type T = (key: string, opts?: Record<string, unknown>) => string

/**
 * "Every day at 07:00 (Riyadh time)", "Every Sunday, Tuesday at 06:30 …", "On day 15 of every month at …". The time,
 * the day of the month and the joined days are each ONE value isolated once (`fsi`): the sentence is a string sink
 * (a list row's text, a `title`), and a time reads backwards under RTL when it is not isolated.
 */
export function cadenceSummary(schedule: Pick<AnalyticsSchedule, 'cadence' | 'time'>, t: T): string {
  const time = fsi(schedule.time)
  const c = schedule.cadence
  if (c.kind === 'daily') return t('schedule.cadence.summary.daily', { time })
  if (c.kind === 'monthly') return t('schedule.cadence.summary.monthly', { day: fsi(String(c.day)), time })
  const days = [...new Set(c.days)].sort((a, b) => a - b)
  if (!days.length) return t('schedule.cadence.summary.noDays')
  return t('schedule.cadence.summary.weekly', { days: fsi(days.map((d) => t(`schedule.day.${d}`)).join(t('schedule.daysJoin'))), time })
}

/** The relay's limit per schedule (803; the tenant's real Workspace limits are an open ask). */
export const RECIPIENT_CAP = 25
/** Report mail stays inside the company (803). */
export const COMPANY_DOMAIN = '@al-dawaa.com.sa'

/** Why a candidate may not receive a report: outside its audience, without the run grant, or not a company address. */
export type RecipientBar = 'audience' | 'runGrant' | 'address'

const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** A company address: something, then exactly `@al-dawaa.com.sa` (no subdomain), without regard to case. */
const companyAddress = (email: string | undefined): boolean => {
  const e = (email ?? '').trim().toLowerCase()
  return e.endsWith(COMPANY_DOMAIN) && e.length > COMPANY_DOMAIN.length && e.indexOf('@') === e.length - COMPANY_DOMAIN.length
}

/**
 * Whether a user sits in the report's audience: a Personal report's is its owner alone; a Certified one, or one
 * Shared with everyone, reaches every analytics user; a chosen audience reaches the users it names, and those the
 * server says its roles hold (`inAudience` — role membership is authz's to resolve; absent reads as no).
 */
function inAudience(user: AnalyticsAudienceUser, item: Pick<AnalyticsItem, 'tier' | 'owner' | 'audience'>): boolean {
  if (item.tier === 'personal') return sameId(user.id, item.owner)
  if (item.tier === 'certified' || !item.audience || item.audience.everyone) return true
  return user.inAudience === true || item.audience.users.some((u) => sameId(u.id, user.id))
}

/** Why `user` may not receive the report, checked in §C's order (audience, run grant, address); `null` when they may. */
export function recipientBar(user: AnalyticsAudienceUser, item: Pick<AnalyticsItem, 'tier' | 'owner' | 'audience'>): RecipientBar | null {
  if (!inAudience(user, item)) return 'audience'
  if (user.canRun !== true) return 'runGrant'
  if (!companyAddress(user.email)) return 'address'
  return null
}

/**
 * The recipients the schedule editor offers from the candidates: only those with no bar, and each other one with its
 * bar. At `RECIPIENT_CAP` chosen it is `full` and offers only those already chosen, so a 26th cannot be ticked. The
 * server checks again at save (`ANALYTICS-414`) and at every send.
 */
export function recipientFilter(
  users: readonly AnalyticsAudienceUser[],
  item: Pick<AnalyticsItem, 'tier' | 'owner' | 'audience'>,
  chosen: readonly string[],
): { offered: AnalyticsAudienceUser[]; barred: { user: AnalyticsAudienceUser; bar: RecipientBar }[]; full: boolean } {
  const offered: AnalyticsAudienceUser[] = []
  const barred: { user: AnalyticsAudienceUser; bar: RecipientBar }[] = []
  for (const user of users) {
    const bar = recipientBar(user, item)
    if (bar) barred.push({ user, bar })
    else offered.push(user)
  }
  const full = chosen.length >= RECIPIENT_CAP
  return { offered: full ? offered.filter((u) => chosen.some((c) => sameId(c, u.id))) : offered, barred, full }
}

// ── ANALYTICS-414: an invalid recipient. ⚠ `data.recipients[]` is `{ id, why }` (proposed, BackOffice to confirm). ──

/** Why the server refused a recipient: §C's four, or `null` when it said something this screen does not know. */
export type RecipientRefusal = { id: string; why: RecipientBar | 'cap' | null }

const REFUSAL_WHY = ['audience', 'runGrant', 'address', 'cap'] as const

/** The recipients an `ANALYTICS-414` names, each with its reason; `[]` when it names none; `null` for any other failure. */
export function refusedRecipients(err: unknown): RecipientRefusal[] | null {
  if (apiErrorCode(err) !== 'ANALYTICS-414') return null
  return list(rec(apiErrorData(err)).recipients).flatMap((x): RecipientRefusal[] => {
    const r = rec(x)
    const id = text(r.id)
    if (!id) return []
    return [{ id, why: (REFUSAL_WHY as readonly unknown[]).includes(r.why) ? (r.why as RecipientRefusal['why']) : null }]
  })
}

// ── The proposed wire (BackOffice 3378), read defensively beside its one reader, like `./audience`. ──
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const values = (v: unknown): Record<string, ParamValue> => rec(v) as Record<string, ParamValue>

function readCadence(v: unknown): AnalyticsScheduleCadence {
  const c = rec(v)
  if (c.kind === 'weekly') return { kind: 'weekly', days: list(c.days).filter((d): d is Weekday => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) }
  if (c.kind === 'monthly' && Number.isInteger(c.day)) return { kind: 'monthly', day: c.day as number }
  return { kind: 'daily' }
}

/** One schedule: an unknown cadence reads as daily, a language other than Arabic as English, no suspension as none. */
export function readSchedule(raw: unknown): AnalyticsSchedule {
  const s = rec(raw)
  const susp = s.suspended && typeof s.suspended === 'object' ? rec(s.suspended) : null
  return {
    id: text(s.id),
    cadence: readCadence(s.cadence),
    time: text(s.time),
    values: values(s.values),
    lang: s.lang === 'ar' ? 'ar' : 'en',
    recipients: list(s.recipients).filter((r): r is string => typeof r === 'string' && !!r),
    enabled: s.enabled === true,
    suspended: susp ? { reason: text(susp.reason), ...(text(susp.param) ? { param: text(susp.param) } : {}), ...(text(susp.message) ? { message: text(susp.message) } : {}) } : null,
  }
}

export const readSchedules = (raw: unknown): AnalyticsSchedule[] => list(raw).map(readSchedule).filter((s) => s.id)

const TRIGGERS: readonly AnalyticsRunTrigger[] = ['schedule', 'late', 'sendNow']
const OUTCOMES: readonly AnalyticsRunOutcome[] = ['sent', 'chartsUnavailable', 'stopped', 'skipped', 'failed']

/** One kept run: its artefacts read as gone unless the record says they are kept (a 410 says the same). */
export function readRun(raw: unknown): AnalyticsReportRun {
  const r = rec(raw)
  const summary = r.summary && typeof r.summary === 'object' ? rec(r.summary) : null
  return {
    id: text(r.id),
    reportId: text(r.reportId),
    scheduleId: text(r.scheduleId) || null,
    revision: typeof r.revision === 'number' ? r.revision : 0,
    ranAt: text(r.ranAt),
    dataAsOf: text(r.dataAsOf) || null,
    trigger: TRIGGERS.includes(r.trigger as AnalyticsRunTrigger) ? (r.trigger as AnalyticsRunTrigger) : 'schedule',
    values: values(r.values),
    recipients: list(r.recipients).map(readUser).filter((u) => u.id),
    dropped: list(r.dropped).map(readUser).filter((u) => u.id),
    outcome: OUTCOMES.includes(r.outcome as AnalyticsRunOutcome) ? (r.outcome as AnalyticsRunOutcome) : 'failed',
    summary: summary ? { en: text(summary.en), ar: text(summary.ar) } : null,
    artefactsKept: r.artefactsKept === true,
    hasPdf: r.hasPdf === true,
  }
}

export const readRuns = (raw: unknown): AnalyticsReportRun[] => list(raw).map(readRun).filter((r) => r.id)

/**
 * A kept run's HTML or PDF past its 90 days: the artefact door answers HTTP `410` (the record stays). Not
 * `ANALYTICS-410`, which is an area being unavailable.
 */
export const isGone = (err: unknown): boolean => err instanceof ApiError && err.statusCode === 410 && apiErrorCode(err) !== 'ANALYTICS-410'
