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
