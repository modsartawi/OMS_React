/**
 * Feeds and switches, and the fleet line (oms 942, BackOffice spec 4157 stories 71–72) — pure. The facts that belong to
 * no store: each feed's last full pass, the reserved recompute, the held-served switch, the hold ledger reader and
 * today's take door. A fact the server could not answer is **no answer** — drawn as such, never as healthy (stock
 * health's precedent). The fleet facts that are a problem now are said once, above the stores list.
 */
import type { StockConsoleFleet, StockConsoleFleetProblem } from '@/core/models/stock-console'

export const FLEET_FACTS = ['feeds', 'reservedRun', 'heldServed', 'ledgerReader', 'takesToday'] as const
export type FleetFact = (typeof FLEET_FACTS)[number]

/** No answer; answered; answered and plainly a problem (never ran, keeps failing). The page judges nothing finer. */
export type FactView = 'noAnswer' | 'answered' | 'problem'

export function factView(fleet: StockConsoleFleet, fact: FleetFact): FactView {
  switch (fact) {
    case 'feeds': {
      const feeds = fleet.feeds
      // An empty list is no answer: it would otherwise read as "every feed is fine".
      if (!feeds || feeds.length === 0) return 'noAnswer'
      return feeds.some((f) => !f.lastCompletePassAt) ? 'problem' : 'answered'
    }
    case 'reservedRun': {
      const run = fleet.reservedRun
      if (!run) return 'noAnswer'
      return !run.lastSuccessAt || run.consecutiveFailures > 0 ? 'problem' : 'answered'
    }
    case 'ledgerReader': {
      const reader = fleet.ledgerReader
      if (!reader) return 'noAnswer'
      return !reader.lastPassAt ? 'problem' : 'answered'
    }
    case 'heldServed':
      return fleet.heldServed ? 'answered' : 'noAnswer'
    case 'takesToday':
      return fleet.takesToday ? 'answered' : 'noAnswer'
  }
}

const KNOWN_FEEDS = ['Sap', 'Pos']

/** A feed's name: SAP and the till in words; another as it came. */
export const feedLabel = (feed: string): { key: string } | { raw: string } =>
  KNOWN_FEEDS.includes(feed) ? { key: `fleet.feed.${feed}` } : { raw: feed }

const KNOWN_PROBLEMS = ['FeedLate', 'ReservedNeverRun', 'ReservedStale', 'ReaderBehind', 'TakesFailing']

export interface FleetLineItem {
  fact: string
  /** `fleetLine.<fact>`, or `fleetLine.unknown` (said with the fact's name). */
  key: string
  subject: { key: string } | { raw: string } | null
  value: number | null
  limit: number | null
  since: string | null
}

/** The fleet line: one sentence per fleet fact that is a problem now, in the server's order; none when all is well. */
export function fleetLine(problems: readonly StockConsoleFleetProblem[]): FleetLineItem[] {
  return problems.map((p) => ({
    fact: p.fact,
    key: KNOWN_PROBLEMS.includes(p.fact) ? `fleetLine.${p.fact}` : 'fleetLine.unknown',
    subject: p.subject ? feedLabel(p.subject) : null,
    value: typeof p.value === 'number' ? p.value : null,
    limit: typeof p.limit === 'number' ? p.limit : null,
    since: p.since ?? null,
  }))
}
