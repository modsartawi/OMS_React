/**
 * The simulator's server calls (ticket 962, BackOffice spec 4354 §11), through `@/core/api`. Wrapped in TanStack Query
 * at the page. ⚠ Neither door exists yet (BackOffice 4355–4357 open): the drive stubs both.
 */
import { api } from '@/core/api'
import type { AdviseReply, AdviseWhyNot, PlanGoal, SimulatorWorkbench } from '@/core/models/sourcing-run'
import type { SimulatorRequest } from './replay'

export const simulatorApi = {
  /**
   * `POST SourcingAdvisor/Advise` — the user's route (BackOffice 4281 decision 3). One request, one reply, nothing to
   * poll. An error is a true HTTP status with the code in the envelope's error list (4281 decision 51).
   */
  advise: (body: SimulatorRequest) => api.post<AdviseReply>('SourcingAdvisor/Advise', body),
  /**
   * `GET SourcingAdvisor/Workbench` — Google's key for the map the customer is placed on.
   * PROVISIONAL (spec 4354: not specified) — no key source is decided for the advisor; the door's name is ours.
   */
  workbench: () => api.get<SimulatorWorkbench>('SourcingAdvisor/Workbench'),
  /**
   * `GET SourcingAdvisor/WhyNot` — "why not another store" (ticket 965, spec 4354 story 28): one store's rows of the
   * held run's `search.whyNot[]` for one goal, in 4281's row shape (decision 27).
   * PROVISIONAL (spec 4354: not specified) — the door, its path and its query `runId`, `store`, `goal` are ours. A run no
   * longer held answers `ADVISE-404`, as the replan does.
   */
  whyNot: (runId: string, store: string, goal: PlanGoal) => api.get<AdviseWhyNot[]>('SourcingAdvisor/WhyNot', { runId, store, goal }),
}

export const workbenchQuery = () => ({
  queryKey: ['sourcing-simulator', 'workbench'] as const,
  queryFn: simulatorApi.workbench,
  staleTime: Infinity,
  retry: false,
})
