/**
 * The simulator's server calls (ticket 962, BackOffice spec 4354 §11), through `@/core/api`. Wrapped in TanStack Query
 * at the page. ⚠ Neither door exists yet (BackOffice 4355–4357 open): the drive stubs both.
 */
import { api } from '@/core/api'
import type {
  AdviseReply,
  AdviseWhyNot,
  KeepRunRequest,
  KeptRun,
  PlanGoal,
  StoredRun,
  SimulatorWorkbench,
  WeightSetCopyRequest,
  WeightSetListItem,
  WeightSetVersion,
  WeightSetVersionRef,
} from '@/core/models/sourcing-run'
import type { SimulatorRequest } from './replan-model'

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
   * `GET SourcingAdvisor/WeightSets` — the sets and their versions, for the panel's picker (ticket 963; BackOffice 4360
   * `WeightSetEndpoints`, under the run grant). Retired sets are left out unless asked: the picker never offers one.
   */
  weightSets: () => api.get<WeightSetListItem[]>('SourcingAdvisor/WeightSets'),
  /** `GET SourcingAdvisor/WeightSets/Version?name=&version=` — one saved version, read whole (BackOffice 4360). */
  weightSetVersion: (ref: WeightSetVersionRef) => api.get<WeightSetVersion>('SourcingAdvisor/WeightSets/Version', { name: ref.name, version: ref.version }),
  /**
   * `POST SourcingAdvisor/WeightSets/Copy` — "Save as a named set", under the save grant (BackOffice 4360: "with values,
   * the simulator's save as a named set of a draft"). The reply names the version saved: the new set's version 1.
   */
  saveWeightSet: (body: WeightSetCopyRequest) => api.post<WeightSetVersionRef>('SourcingAdvisor/WeightSets/Copy', body),
  /**
   * `GET SourcingAdvisor/WhyNot` — "why not another store" (ticket 965, spec 4354 story 28): one store's rows of the
   * held run's `search.whyNot[]` for one goal, in 4281's row shape (decision 27).
   * PROVISIONAL (spec 4354: not specified) — the door, its path and its query `runId`, `store`, `goal` are ours. A run no
   * longer held answers `ADVISE-404`, as the replan does.
   */
  whyNot: (runId: string, store: string, goal: PlanGoal) => api.get<AdviseWhyNot[]>('SourcingAdvisor/WhyNot', { runId, store, goal }),
  /**
   * Keep the held run under a name (ticket 969, spec 4354 §12; BackOffice 4380 "Doors: keep, list, open, delete"). The
   * full record is stored for good. A run no longer held answers `ADVISE-404`, as the replan does.
   * PROVISIONAL (spec 4354: not specified) — the path `SourcingAdvisor/Runs/Keep`, its body and reply are ours.
   */
  keepRun: (body: KeepRunRequest) => api.post<KeptRun>('SourcingAdvisor/Runs/Keep', body),
  /**
   * The caller's kept runs (BackOffice 4380 "list").
   * PROVISIONAL (spec 4354: not specified) — the path `SourcingAdvisor/Runs/Kept` and its reply are ours.
   */
  keptRuns: () => api.get<KeptRun[]>('SourcingAdvisor/Runs/Kept'),
  /**
   * Delete one's own kept run (BackOffice 4380: "the keeper may delete"); its link stops opening.
   * PROVISIONAL (spec 4354: not specified) — `DELETE SourcingAdvisor/Runs/Kept?runId=` is ours.
   */
  deleteKeptRun: (runId: string) => api.del<null>('SourcingAdvisor/Runs/Kept', { runId }),
  /**
   * Open a stored run by its link (BackOffice 4380 "open"): "a read door of the simulator's build, which solves again
   * from the stored copy" — not an advise call (BackOffice 4281 decision 11). The stored plans stay the truth; the reply
   * says when a newer engine answers differently. A run not there (deleted, or never kept) answers `ADVISE-404`.
   * PROVISIONAL (spec 4354: not specified) — the path `SourcingAdvisor/Runs/Open`, its query `runId` and reply are ours.
   */
  openRun: (runId: string) => api.get<StoredRun>('SourcingAdvisor/Runs/Open', { runId }),
}

export const keptRunsQuery = () => ({
  queryKey: ['sourcing-simulator', 'kept-runs'] as const,
  queryFn: simulatorApi.keptRuns,
  retry: false,
})

export const storedRunQuery = (runId: string | null) => ({
  queryKey: ['sourcing-simulator', 'stored-run', runId ?? ''] as const,
  queryFn: () => simulatorApi.openRun(runId!),
  enabled: !!runId,
  // A stored run is never changed; only deleted.
  staleTime: Infinity,
  retry: false,
})

export const weightSetsQuery = () => ({
  queryKey: ['sourcing-simulator', 'weight-sets'] as const,
  queryFn: simulatorApi.weightSets,
  retry: false,
})

export const weightSetVersionQuery = (ref: WeightSetVersionRef | null) => ({
  queryKey: ['sourcing-simulator', 'weight-set', ref?.name ?? '', ref?.version ?? 0] as const,
  queryFn: () => simulatorApi.weightSetVersion(ref!),
  enabled: !!ref,
  // A saved version is never edited (spec 4354 §10).
  staleTime: Infinity,
  retry: false,
})

export const workbenchQuery = () => ({
  queryKey: ['sourcing-simulator', 'workbench'] as const,
  queryFn: simulatorApi.workbench,
  staleTime: Infinity,
  retry: false,
})
