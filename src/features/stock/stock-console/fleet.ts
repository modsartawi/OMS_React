/**
 * Feeds and switches, and the fleet line (oms 942, BackOffice spec 4157 stories 71–72) — pure. The facts that belong to
 * no store: each feed's last full pass, the reserved recompute, the held-served switch, the hold ledger reader and
 * today's take door. A fact the server could not answer is **no answer** — drawn as such, never as healthy (stock
 * health's precedent). The fleet facts that are a problem now are said once, above the stores list.
 */
import type { StockConsoleFleet, StockConsoleFleetProblem } from '@/core/models/stock-console'

export const FLEET_FACTS = ['feeds', 'reservedRun', 'heldServed', 'ledgerReader', 'takesToday'] as const
export type FleetFact = (typeof FLEET_FACTS)[number]

/** No answer; answered; answered and a problem — plainly so (never ran, keeps failing, fell back) or by the server. */
export type FactView = 'noAnswer' | 'answered' | 'problem'

/**
 * The fleet-line facts each card answers for (BO 4160). The server judges them — "stale" is 15 minutes outside the
 * recompute's quiet window, a SIS.Api setting — so the page does not re-time a fact; it reads the judgement.
 */
const FACT_PROBLEMS: Record<FleetFact, readonly string[]> = {
  feeds: ['FeedLate'],
  reservedRun: ['ReservedNeverRun', 'ReservedStale'],
  heldServed: ['HeldServedFellBack'],
  ledgerReader: ['ReaderBehind'],
  takesToday: ['TakesFailing'],
}

/** Whether the fact is plainly a problem from its own figures (an answered fact only). */
function plainProblem(fleet: StockConsoleFleet, fact: FleetFact): boolean {
  switch (fact) {
    case 'feeds':
      return (fleet.feeds ?? []).some((f) => !f.lastCompletePassAt)
    case 'reservedRun':
      return !fleet.reservedRun?.lastSuccessAt || (fleet.reservedRun?.consecutiveFailures ?? 0) > 0
    case 'ledgerReader':
      return !fleet.ledgerReader?.lastPassAt
    case 'heldServed': {
      // Off on purpose subtracts nothing because it was asked not to; on without held subtracted, or fallen back, is a problem.
      const sw = fleet.heldServed
      return !!sw && (!!sw.fellBackAt || (sw.served && !sw.subtractsHeld))
    }
    case 'takesToday':
      return false
  }
}

export function factView(fleet: StockConsoleFleet, fact: FleetFact): FactView {
  const answer = fleet[fact]
  // An empty list of feeds is no answer: it would otherwise read as "every feed is fine".
  if (answer == null || (Array.isArray(answer) && answer.length === 0)) return 'noAnswer'
  const judged = (fleet.problems ?? []).some((p) => FACT_PROBLEMS[fact].includes(p.fact))
  return judged || plainProblem(fleet, fact) ? 'problem' : 'answered'
}

const KNOWN_FEEDS = ['Sap', 'Pos']

/** A feed's name: SAP and the till in words; another as it came. */
export const feedLabel = (feed: string): { key: string } | { raw: string } =>
  KNOWN_FEEDS.includes(feed) ? { key: `fleet.feed.${feed}` } : { raw: feed }

export const KNOWN_PROBLEMS = Object.values(FACT_PROBLEMS).flat()

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
