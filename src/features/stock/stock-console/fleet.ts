/**
 * Feeds and switches, and the fleet line (oms 942, BackOffice spec 4157 stories 71–72) — pure. The facts that belong to
 * no store (`GET StockConsole/Fleet`, BO 4160): each feed's last full pass, the reserved recompute, the held-served
 * switch, the hold ledger reader and today's take door. A fact whose status route gave no answer (`answered` false) is
 * **no answer** — drawn as such, never as healthy (stock health's precedent). The fleet facts that are a problem now are
 * said once, above the stores list.
 */
import {
  FLEET_FEEDS,
  FLEET_PROBLEM_CODES,
  type StockConsoleFleet,
  type StockConsoleFleetProblem,
} from '@/core/models/stock-console'

export const FLEET_FACTS = ['feeds', 'reserved', 'heldServed', 'reader', 'takes'] as const
export type FleetFact = (typeof FLEET_FACTS)[number]

/** No answer; answered; answered and a problem — as the server judges it, or plainly so. */
export type FactView = 'noAnswer' | 'answered' | 'problem'

/**
 * Whether an answered fact is a problem. The server judges late, stale and behind on its own settings (the feed watch's
 * limits, `ReservedStaleMinutes` outside the quiet window, `ReaderBehindMinutes`), so the page reads the judgement and
 * does not re-time a fact. The held-served switch it does not judge: on without held subtracted, or fallen back, is.
 */
function isProblem(fleet: StockConsoleFleet, fact: FleetFact): boolean {
  switch (fact) {
    case 'feeds':
      return fleet.feeds.rows.some((f) => f.late)
    case 'reserved':
      return fleet.reserved.state !== 'Computed' || fleet.reserved.consecutiveFailures > 0
    case 'reader':
      return fleet.reader.behind
    case 'heldServed': {
      // Off on purpose subtracts nothing because it was asked not to; on without held subtracted, or fallen back, is a problem.
      const sw = fleet.heldServed
      return !!sw.fellBackAt || (sw.served && !sw.subtractsHeld)
    }
    case 'takes':
      return false
  }
}

export function factView(fleet: StockConsoleFleet, fact: FleetFact): FactView {
  // A route that gave no answer leaves its other fields at their defaults: they say nothing.
  if (!fleet[fact].answered) return 'noAnswer'
  return isProblem(fleet, fact) ? 'problem' : 'answered'
}

/** A feed's name (`StockFeedNames`): Stock Visibility's feeds in our words; another as it came. */
export const feedLabel = (feed: string): { key: string } | { raw: string } =>
  (FLEET_FEEDS as readonly string[]).includes(feed) ? { key: `fleet.feed.${feed}` } : { raw: feed }

export interface FleetLineItem {
  code: string
  /** `fleetLine.<code>`, or `fleetLine.unknown` (said with the code). */
  key: string
  /** A feed in our words; the recompute, the reader or a status route as sent (a code). */
  subject: { key: string } | { raw: string } | null
  /** Minutes. */
  value: number | null
  limit: number | null
}

/** The fleet line: one sentence per fleet fact that is a problem now, in the server's order; none when all is well. */
export function fleetLine(problems: readonly StockConsoleFleetProblem[]): FleetLineItem[] {
  return problems.map((p) => ({
    code: p.code,
    key: (FLEET_PROBLEM_CODES as readonly string[]).includes(p.code) ? `fleetLine.${p.code}` : 'fleetLine.unknown',
    subject: p.subject ? feedLabel(p.subject) : null,
    value: p.value,
    limit: p.limit,
  }))
}
