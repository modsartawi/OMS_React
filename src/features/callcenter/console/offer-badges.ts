/**
 * The pitch card's badges (spec 995 D4, ticket 996) — server facts, never client rules.
 *
 * - *Phone orders only* ⇐ `audience.channelOnly`.
 * - The tier badge ⇐ `audience.tiers[]`, with ✓ or ✗ from `audience.callerQualifies`. The console
 *   never compares a tier itself: the order's tier is the server's.
 * - *Ends Thu 3 Dec · 6 days left* ⇐ `endsOn`. Days left is the one thing worked out here, against
 *   the console's local clock, in calendar days, and the badge shows only within 14 days.
 */
import type { TFunction } from 'i18next'
import type { OfferAudience } from '@/core/models/callcenter'
import { listText } from '@/core/util/list-format'
import type { GuidancePhrase } from './guidance-view'

export type OfferBadge =
  | { kind: 'phoneOnly' }
  | { kind: 'tier'; codes: string[]; qualifies: boolean }
  /** `date` is the day as `yyyy-mm-dd`; the render tier formats it in the reader's language. */
  | { kind: 'ends'; date: string; days: number }

/** D4 — shown only when the offer ends within this many days. */
export const ENDS_WITHIN_DAYS = 14

export function offerBadges(
  audience: OfferAudience | null | undefined,
  endsOn: string | null | undefined,
  now: Date,
): OfferBadge[] {
  const badges: OfferBadge[] = []
  if (audience?.channelOnly === true) badges.push({ kind: 'phoneOnly' })
  const codes = (audience?.tiers ?? []).filter((code) => typeof code === 'string' && code.trim() !== '')
  if (audience && codes.length > 0)
    badges.push({ kind: 'tier', codes: codes.map((code) => code.trim()), qualifies: audience.callerQualifies === true })
  const ends = endsBadge(endsOn, now)
  if (ends) badges.push(ends)
  return badges
}

/** *Platinum, Gold, or Silver members* — any one of the tiers qualifies, so a disjunction. A code
 *  this console has no name for is shown as the code rather than dropped. */
export function tierPhrase(codes: string[], t: TFunction, lang: string): GuidancePhrase {
  const names = codes.map((code) => t(`callcenter:offer.tier.${code}`, { defaultValue: code }))
  return { key: 'callcenter:offer.badge.tiers', params: { tiers: listText(names, lang, 'disjunction') } }
}

/** The offer's last day, in the reader's language: *Thu 3 Dec*. */
export function formatOfferDay(date: string, lang: string, length: 'short' | 'long' = 'short'): string {
  const day = dayOf(date)
  if (!day) return date
  // English as the walk says it (*Thu 3 Dec*): day before month, the Saudi and British order.
  const locale = lang.startsWith('en') ? 'en-GB' : lang
  return new Intl.DateTimeFormat(locale, { weekday: length, day: 'numeric', month: length }).format(day)
}

function endsBadge(endsOn: string | null | undefined, now: Date): OfferBadge | null {
  const day = endsOn ? dayOf(endsOn) : null
  if (!day || !endsOn) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Calendar days between two local midnights; rounded, so a DST change is not a day.
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000)
  if (days < 0 || days > ENDS_WITHIN_DAYS) return null
  return { kind: 'ends', date: endsOn.slice(0, 10), days }
}

/** `2026-12-03` (or a datetime that starts with it) as that LOCAL day; `null` otherwise. */
function dayOf(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [year, month, date] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])]
  const day = new Date(year, month, date)
  return day.getMonth() === month && day.getDate() === date ? day : null
}
