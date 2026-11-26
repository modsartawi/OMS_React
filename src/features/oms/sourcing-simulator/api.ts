/**
 * The simulator's server calls (ticket 962, BackOffice spec 4354 §11), through `@/core/api`. Wrapped in TanStack Query
 * at the page. ⚠ Neither door exists yet (BackOffice 4355–4357 open): the drive stubs both.
 */
import { api } from '@/core/api'
import type {
  AdviseCartRequest,
  AdviseReply,
  AdviseRerunRequest,
  SimulatorWorkbench,
  WeightSetListItem,
  WeightSetSaveRequest,
  WeightSetVersion,
  WeightSetVersionRef,
} from '@/core/models/sourcing-run'

export const simulatorApi = {
  /**
   * `POST SourcingAdvisor/Advise` — the user's route (BackOffice 4281 decision 3). One request, one reply, nothing to
   * poll. An error is a true HTTP status with the code in the envelope's error list (4281 decision 51).
   */
  advise: (body: AdviseCartRequest | AdviseRerunRequest) => api.post<AdviseReply>('SourcingAdvisor/Advise', body),
  /**
   * `GET SourcingAdvisor/Workbench` — Google's key for the map the customer is placed on.
   * PROVISIONAL (spec 4354: not specified) — no key source is decided for the advisor; the door's name is ours.
   */
  workbench: () => api.get<SimulatorWorkbench>('SourcingAdvisor/Workbench'),
  /**
   * The weight sets and their versions, for the panel's picker (ticket 963; BackOffice 4360 "list sets and versions").
   * PROVISIONAL (spec 4354: not specified) — 4360 names the door but not its path: `SourcingAdvisor/WeightSets` is ours.
   */
  weightSets: () => api.get<WeightSetListItem[]>('SourcingAdvisor/WeightSets'),
  /**
   * One saved version, read whole (BackOffice 4360 "read a version").
   * PROVISIONAL (spec 4354: not specified) — the path `SourcingAdvisor/WeightSets/Version` and its params are ours.
   */
  weightSetVersion: (ref: WeightSetVersionRef) => api.get<WeightSetVersion>('SourcingAdvisor/WeightSets/Version', { name: ref.name, version: ref.version }),
  /**
   * Save the draft as a named set, under the save grant (BackOffice 4360 "save, copy"). The reply names the version saved.
   * PROVISIONAL (spec 4354: not specified) — the path `SourcingAdvisor/WeightSets/Save` is ours.
   */
  saveWeightSet: (body: WeightSetSaveRequest) => api.post<WeightSetVersionRef>('SourcingAdvisor/WeightSets/Save', body),
}

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
