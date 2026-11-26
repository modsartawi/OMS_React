/**
 * The comparison results page's server calls (ticket 971, spec 4354 §17; doors BackOffice 4393, unbuilt — every
 * drive stubs exactly this wire). Read-only, under today's advisor view grant (`SourcingAdvisor:01`).
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 *
 * 🚩 PROVISIONAL (spec 4354: not specified) — every path below, and every query name. BO 4393 names the content of
 * the replies and no door; reconcile with it as built. Tickets 972 and 973 add their tabs' doors here.
 */
import { api } from '@/core/api'
import type {
  BarDirection,
  BarMark,
  BarQuery,
  BarReply,
  BarRuling,
  FactorTableReply,
  ResultsView,
  TrialRow,
  TrialStartRequest,
  TrialsReply,
  ResultsBreakdownBy,
  ResultsBreakdownsReply,
  ResultsChecksReply,
  ResultsLaterSlotsReply,
  ResultsNotRunReply,
  ResultsOutsideRulesReply,
  ResultsOrderCard,
  ResultsOrderSort,
  ResultsOrdersReply,
  ResultsQuery,
  ResultsSummaryReply,
} from '@/core/models/sourcing-results'

export interface ResultsOrdersQuery extends ResultsQuery {
  /** The figure behind the drawer, encoded by `./figure`. */
  figure: string
  page: number
  pageSize: number
  sort: ResultsOrderSort
  descending: boolean
}

export const sourcingResultsApi = {
  /** `GET SourcingAdvisor/Results/Summary` — the top, the three panels and "where the plans differ". */
  summary(query: ResultsQuery): Promise<ResultsSummaryReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<ResultsSummaryReply>('SourcingAdvisor/Results/Summary', { ...query })
  },
  /** `GET SourcingAdvisor/Results/Orders` — the orders behind a figure, paged and sorted. */
  orders(query: ResultsOrdersQuery): Promise<ResultsOrdersReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<ResultsOrdersReply>('SourcingAdvisor/Results/Orders', { ...query })
  },
  /** `GET SourcingAdvisor/Results/Order?orderNumber=` — one order's card. */
  order(orderNumber: string): Promise<ResultsOrderCard> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<ResultsOrderCard>('SourcingAdvisor/Results/Order', { orderNumber })
  },

  // ── Trials (ticket 973; BO 4394 "a door of its own", unbuilt) ──────────────────────────────────────

  /** `GET SourcingAdvisor/Trials` — the list of trials and what the start form may pick. */
  trials(): Promise<TrialsReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<TrialsReply>('SourcingAdvisor/Trials')
  },
  /** `POST SourcingAdvisor/Trials/Start` — under the save grant; a repeat is answered from the kept trial. */
  startTrial(body: TrialStartRequest): Promise<TrialRow> {
    // PROVISIONAL (spec 4354: not specified)
    return api.post<TrialRow>('SourcingAdvisor/Trials/Start', body)
  },
  /** `GET SourcingAdvisor/Trials/Factors?trialId=` — the factor table of one trial's version and period. */
  factors(trialId: string): Promise<FactorTableReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<FactorTableReply>('SourcingAdvisor/Trials/Factors', { trialId })
  },
  /** `POST SourcingAdvisor/Trials/Factors` — starts the factor table's job (the save grant's). */
  startFactors(trialId: string): Promise<FactorTableReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.post<FactorTableReply>('SourcingAdvisor/Trials/Factors', { trialId })
  },

  // ── The phase 2 bar (ticket 973; BO 4396 "SIS.Api doors", unbuilt) ─────────────────────────────────

  /** `GET SourcingAdvisor/Phase2Bar` — one reading of the bar for 28 days and a channel group. */
  bar(query: BarQuery): Promise<BarReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<BarReply>('SourcingAdvisor/Phase2Bar', { ...query })
  },
  /** `POST SourcingAdvisor/Phase2Bar/Mark` — a person marks one of the largest differences. Answers the reading. */
  markLargest(query: BarQuery, body: { orderNumber: string; view: ResultsView; direction: BarDirection; mark: BarMark }): Promise<BarReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.post<BarReply>('SourcingAdvisor/Phase2Bar/Mark', { ...query, ...body })
  },
  /** `POST SourcingAdvisor/Phase2Bar/Ruling` — a written ruling (a reason outside the rules, a shelf chance figure). */
  writeRuling(query: BarQuery, body: { subject: BarRuling['subject']; key: string; text: string }): Promise<BarReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.post<BarReply>('SourcingAdvisor/Phase2Bar/Ruling', { ...query, ...body })
  },
  /** `POST SourcingAdvisor/Phase2Bar/Accept` — the owner accepts this reading; it is kept with who, when, each figure. */
  acceptBar(query: BarQuery & { to: string }): Promise<BarReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.post<BarReply>('SourcingAdvisor/Phase2Bar/Accept', query)
  },
}

/**
 * The five reading tabs' doors (ticket 972): each tab reads its own when it opens, with the page's filters.
 * 🚩 PROVISIONAL (spec 4354: not specified) — every path, and the query name `by`. BO 4393 names the content only.
 */
export const readingTabsApi = {
  /** `GET SourcingAdvisor/Results/Breakdowns` + `by` — the Breakdowns tab. */
  breakdowns(query: ResultsQuery, by: ResultsBreakdownBy): Promise<ResultsBreakdownsReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<ResultsBreakdownsReply>('SourcingAdvisor/Results/Breakdowns', { ...query, by })
  },
  /** `GET SourcingAdvisor/Results/OutsideRules` — outside the advisor's rules, by reason. */
  outsideRules(query: ResultsQuery): Promise<ResultsOutsideRulesReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<ResultsOutsideRulesReply>('SourcingAdvisor/Results/OutsideRules', { ...query })
  },
  /** `GET SourcingAdvisor/Results/Checks` — Dawaa Now by distance band, the stock check, the shelf chance evidence. */
  checks(query: ResultsQuery): Promise<ResultsChecksReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<ResultsChecksReply>('SourcingAdvisor/Results/Checks', { ...query })
  },
  /** `GET SourcingAdvisor/Results/LaterSlots` — the later-slot count by hour. */
  laterSlots(query: ResultsQuery): Promise<ResultsLaterSlotsReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<ResultsLaterSlotsReply>('SourcingAdvisor/Results/LaterSlots', { ...query })
  },
  /** `GET SourcingAdvisor/Results/NotRun` — the orders not run, by reason. */
  notRun(query: ResultsQuery): Promise<ResultsNotRunReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<ResultsNotRunReply>('SourcingAdvisor/Results/NotRun', { ...query })
  },
}
