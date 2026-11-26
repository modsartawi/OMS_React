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
