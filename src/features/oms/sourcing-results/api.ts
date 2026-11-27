/**
 * The comparison results page's server calls (tickets 971–973), reconciled with BackOffice 4393, 4394 and 4396 at
 * pricing2 35a4e56be. Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 *
 * - The results doors (`ResultsEndpoints`): GET, under the advisor view grant `BackOfficeScreen[SourcingAdvisor, 01]`.
 *   Each takes the filter bar (`ResultsQuery`); a bad value is `RESULTS-400`, an order with no summary `RESULTS-404`.
 *   (`Results/OrderRun`, the old order link's door, is `features/oms/sourcing-order-link`'s, ticket 974.)
 * - The trial doors (`TrialEndpoints`): reading under the view grant; starting a trial or a factor table under the save
 *   grant `[SourcingWeightSets, 03]`. Refusals are `WEIGHTSET-4xx`.
 * - The phase 2 bar (`Phase2BarEndpoints`): reading under the view grant; Close and Accept under the candidate-mark grant
 *   `[SourcingCandidateSet, 03]`.
 */
import { api } from '@/core/api'
import type {
  AdvisorCode,
  BarAcceptRequest,
  BarCloseRequest,
  BarKeptReading,
  BarQuery,
  BarReply,
  FactorTableReply,
  ResultsBreakdownBy,
  ResultsBreakdownReply,
  ResultsChecksReply,
  ResultsDifferReply,
  ResultsLaterSlotsReply,
  ResultsNotRunReply,
  ResultsOrderCard,
  ResultsOrdersReply,
  ResultsOutsideReply,
  ResultsPanelsReply,
  ResultsQuery,
  ResultsTopReply,
  ResultsView,
  TrialReply,
  TrialStartRequest,
  TrialsBeside,
} from '@/core/models/sourcing-results'
import type { ResultsOrdersRequest } from './figure'

/** The trials list's cache key: the page's set picker and the Trials tab share it. */
export const TRIALS_KEY = ['sourcing-results', 'trials'] as const

export const sourcingResultsApi = {
  /** `GET SourcingAdvisor/Results/Top` — the sentence, the bar, its brackets and the line under it. */
  top: (query: ResultsQuery) => api.get<ResultsTopReply>('SourcingAdvisor/Results/Top', { ...query }),
  /** `GET SourcingAdvisor/Results/Panels` — the promise check, cost (counts only) and the marks in force. */
  panels: (query: ResultsQuery) => api.get<ResultsPanelsReply>('SourcingAdvisor/Results/Panels', { ...query }),
  /** `GET SourcingAdvisor/Results/Differ?view=` — "where the plans differ" in one view. */
  differ: (query: ResultsQuery, view: ResultsView) => api.get<ResultsDifferReply>('SourcingAdvisor/Results/Differ', { ...query, view }),
  /** `GET SourcingAdvisor/Results/Orders` — the orders behind a figure, paged and sorted (`./figure`). */
  orders: (request: ResultsOrdersRequest) => api.get<ResultsOrdersReply>('SourcingAdvisor/Results/Orders', { ...request }),
  /** `GET SourcingAdvisor/Results/Order?orderNumber=` — one order's card. */
  order: (orderNumber: string) => api.get<ResultsOrderCard>('SourcingAdvisor/Results/Order', { orderNumber }),
  /** `GET SourcingAdvisor/Results/Codes` — the advisor's code list with its words, under the view grant. */
  codes: () => api.get<AdvisorCode[]>('SourcingAdvisor/Results/Codes'),

  // ── The five reading tabs (ticket 972) ─────────────────────────────────────────────────────────────

  /** `GET SourcingAdvisor/Results/Breakdown?by=` — one grouping of the Breakdowns tab. */
  breakdown: (query: ResultsQuery, by: ResultsBreakdownBy) => api.get<ResultsBreakdownReply>('SourcingAdvisor/Results/Breakdown', { ...query, by }),
  /** `GET SourcingAdvisor/Results/Outside` — outside the advisor's rules, by reason. */
  outside: (query: ResultsQuery) => api.get<ResultsOutsideReply>('SourcingAdvisor/Results/Outside', { ...query }),
  /** `GET SourcingAdvisor/Results/Checks` — the promise check, Dawaa Now by distance band, the stock check. */
  checks: (query: ResultsQuery) => api.get<ResultsChecksReply>('SourcingAdvisor/Results/Checks', { ...query }),
  /** `GET SourcingAdvisor/Results/LaterSlots` — the later-slot count by hour. */
  laterSlots: (query: ResultsQuery) => api.get<ResultsLaterSlotsReply>('SourcingAdvisor/Results/LaterSlots', { ...query }),
  /** `GET SourcingAdvisor/Results/NotRun` — orders not run, and orders OMS ran itself, by reason. */
  notRun: (query: ResultsQuery) => api.get<ResultsNotRunReply>('SourcingAdvisor/Results/NotRun', { ...query }),

  // ── Trials (ticket 973; BO 4394) ────────────────────────────────────────────────────────────────

  /** `GET SourcingAdvisor/Trials` — every trial but the factor tables' own rows. */
  trials: () => api.get<TrialReply[]>('SourcingAdvisor/Trials'),
  /** `POST SourcingAdvisor/Trials/Start` — the save grant's; a repeat answers the kept trial (`repeat`). */
  startTrial: (body: TrialStartRequest) => api.post<TrialReply>('SourcingAdvisor/Trials/Start', body),
  /** `GET SourcingAdvisor/Trials/FactorTable?trialId=` — the factor table of a trial of a version as saved. */
  factorTable: (trialId: string) => api.get<FactorTableReply>('SourcingAdvisor/Trials/FactorTable', { trialId }),
  /** `POST SourcingAdvisor/Trials/FactorTable` — the save grant's: starts every row of the table not yet run. */
  startFactorTable: (body: TrialStartRequest) => api.post<FactorTableReply>('SourcingAdvisor/Trials/FactorTable', body),
  /** `GET SourcingAdvisor/Trials/Beside?trialId=&otherId=` — two finished trials over the same period, side by side. */
  beside: (trialId: string, otherId: string) => api.get<TrialsBeside>('SourcingAdvisor/Trials/Beside', { trialId, otherId }),

  // ── The phase 2 bar (ticket 973; BO 4396) ─────────────────────────────────────────────────────────

  /** `GET SourcingAdvisor/Results/Phase2Bar` — one reading for 28 days, a channel group and a step, and those kept. */
  bar: (query: BarQuery) => api.get<BarReply>('SourcingAdvisor/Results/Phase2Bar', { ...query }),
  /** `POST SourcingAdvisor/Results/Phase2Bar/Close` — the candidate-mark grant's; answers the reading (the stores only's step). */
  closeOnBar: (body: BarCloseRequest) => api.post<BarReply>('SourcingAdvisor/Results/Phase2Bar/Close', body),
  /** `POST SourcingAdvisor/Results/Phase2Bar/Accept` — the candidate-mark grant's; keeps the reading as it reads now. */
  acceptBar: (body: BarAcceptRequest) => api.post<BarKeptReading>('SourcingAdvisor/Results/Phase2Bar/Accept', body),
}
