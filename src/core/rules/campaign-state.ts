import { RULE_NEVER, type RuleCampaignStatus, type RuleCampaignWindow, type RuleDraftState } from '@/core/models/rule-campaign'
import type { Severity } from '@/core/ui/severity'
import { toIsoDate } from '@/core/util/date-format'

// A campaign's state and its schedule as words, read at the reader's LOCAL now (ticket 501).
// Shared by the campaigns list and the workspace, and later by Priority and the simulator, so it
// sits in `core/rules` rather than in one feature. Pure: no React, no i18n.
//
// 🚩 Local time only. A day is the local calendar day (`toIsoDate`, never `toISOString`): at
// 01:30 in Riyadh UTC still says yesterday, and a campaign starting today is already running.

/**
 * The tile a campaign counts under. HQ stores four statuses; a LIVE campaign is further read
 * against its schedule as scheduled, running or expired. In the order the list shows its tiles.
 */
export const CAMPAIGN_STATES = ['draft', 'waitingForApproval', 'scheduled', 'running', 'expired', 'disabled'] as const
export type CampaignState = (typeof CAMPAIGN_STATES)[number]

/** Each state's severity — the prototype's dots: a draft quiet, waiting and disabled need a human,
 *  scheduled in motion, running well, expired ended. The badge and the list's tiles both read it. */
export const CAMPAIGN_STATE_SEV: Record<CampaignState, Severity> = {
  draft: 'mute',
  waitingForApproval: 'warn',
  scheduled: 'go',
  running: 'ok',
  expired: 'bad',
  disabled: 'warn',
}

/** A campaign's workspace address — the list's row, its name link and the workspace's own menu. */
export const campaignPath = (id: string) => `/campaigns/${encodeURIComponent(id)}`

/** The simulator (ticket 514); with a campaign's id it runs that campaign's working copy. */
export const simulatorPath = (draftId?: string) =>
  draftId ? `/campaigns/simulator?draft=${encodeURIComponent(draftId)}` : '/campaigns/simulator'

/** A campaign's coupons page — where the coupon finder's campaign link lands. */
export const campaignCouponsPath = (id: string) => `${campaignPath(id)}/coupons`

/** One customer session (ticket 518) — the coupon finder's sale ids open it. */
export const ruleSessionPath = (saleId: string) => `/campaigns/sessions/${encodeURIComponent(saleId)}`

/** The coupon finder (ticket 519), with a code already looked up. */
export const couponFinderPath = (code: string) => `/campaigns/coupon-finder?code=${encodeURIComponent(code)}`

/** Customers (ticket 519), with a member already looked up by loyalty id. */
export const ruleCustomerPath = (loyaltyId: string) => `/campaigns/customers?loyaltyId=${encodeURIComponent(loyaltyId)}`

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** A `yyyy-MM-dd` day, or null when it is absent or malformed (read as "no bound"). */
function dayOf(value: string | null | undefined): string | null {
  return value && DAY.test(value) ? value : null
}

/** Whole calendar days from `a` to `b` (both `yyyy-MM-dd`) — negative when `b` is earlier. */
export function daysBetween(a: string, b: string): number {
  const utc = (d: string) => {
    const [, y, m, day] = DAY.exec(d)!
    return Date.UTC(Number(y), Number(m) - 1, Number(day))
  }
  // Pure calendar arithmetic: both ends are UTC midnights, so no zone or daylight saving moves it.
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/** A time HQ answered, or null for one it never set (`0001-01-01T00:00:00`) or left empty. */
export function setAt(value: string | null | undefined): string | null {
  return value && !value.startsWith(RULE_NEVER.slice(0, 10)) ? value : null
}

/** What a campaign's state is read from: its draft's state (null with no draft), the live
 *  campaign's status, and the window. */
export interface CampaignStateInput {
  state: RuleDraftState | null
  campaignStatus: RuleCampaignStatus
  window?: RuleCampaignWindow | null
}

/**
 * The state a campaign counts under at a local `now` (ticket 522). A draft waiting for an approver
 * counts as waiting whatever the live campaign does (it needs a human); otherwise a published
 * campaign is read against its window (`until` exclusive), a disabled one is disabled, and one that
 * never went live is a draft (editing or sent back). A status HQ has not agreed with us reads as
 * never live, so every campaign counts under exactly one tile and none reaches a till's by accident.
 */
export function campaignState(c: CampaignStateInput, now: Date): CampaignState {
  if (c.state === 'pending') return 'waitingForApproval'
  if (c.campaignStatus === 'Disabled') return 'disabled'
  if (c.campaignStatus !== 'Published') return 'draft'
  const today = toIsoDate(now)
  const until = dayOf(c.window?.until)
  const from = dayOf(c.window?.from)
  if (until && today >= until) return 'expired'
  if (from && today < from) return 'scheduled'
  return 'running'
}

/** Lifecycle order (the tiles'), for sorting by state. */
export const stateOrder = (state: CampaignState): number => CAMPAIGN_STATES.indexOf(state)

/** The schedule as the dashboard says it: starts in / ends in / ended N local days. */
export type ScheduleRelative =
  | { kind: 'noLimit' }
  | { kind: 'noEnd' }
  | { kind: 'startsIn'; days: number }
  | { kind: 'endsIn'; days: number }
  | { kind: 'endedAgo'; days: number }
  | { kind: 'endedToday' }

export function scheduleRelative(window: RuleCampaignWindow | null | undefined, now: Date): ScheduleRelative {
  const today = toIsoDate(now)
  const from = dayOf(window?.from)
  const until = dayOf(window?.until)
  if (!from && !until) return { kind: 'noLimit' }
  if (from && today < from) return { kind: 'startsIn', days: daysBetween(today, from) }
  if (until && today >= until) {
    const days = daysBetween(until, today)
    return days === 0 ? { kind: 'endedToday' } : { kind: 'endedAgo', days }
  }
  return until ? { kind: 'endsIn', days: daysBetween(today, until) } : { kind: 'noEnd' }
}
