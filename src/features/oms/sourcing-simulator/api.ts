/**
 * The simulator's server calls (ticket 962, BackOffice spec 4354 §11), through `@/core/api`. Wrapped in TanStack Query
 * at the page. The advise and kept-run doors are BackOffice 4355–4381 (`AdviseEndpoints`, `StoredRunEndpoints`), each
 * behind the run grant; every refusal is the door's `ADVISE-*` code at its true HTTP status.
 */
import { api } from '@/core/api'
import type {
  AdviseReply,
  KeepRunRequest,
  KeptRun,
  SimulatorWorkbench,
  WeightSetListItem,
  WeightSetSaveRequest,
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
   * Google's key for the map the customer is placed on.
   * SERVER GAP (spec 4354) — BackOffice has no such door: it serves the key only inside the analytics and insurance
   * models. `GET SourcingAdvisor/Workbench` answers 404 until one is added, and the map shows its table.
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
  /**
   * `POST SourcingAdvisor/Runs/Keep { runId, name }` — keep a held run of the caller's under a name (BackOffice 4380):
   * the full record is stored for good. A run no longer held (or not the caller's) answers `ADVISE-404`; one already
   * kept, or a name over 200 characters, `ADVISE-400`.
   */
  keepRun: (body: KeepRunRequest) => api.post<KeptRun>('SourcingAdvisor/Runs/Keep', body),
  /** `GET SourcingAdvisor/Runs/Kept` — every kept run, any keeper's (at most the door's 500). */
  keptRuns: () => api.get<KeptRun[]>('SourcingAdvisor/Runs/Kept'),
  /**
   * `POST SourcingAdvisor/Runs/Delete { runId }` — delete a kept run; its link stops opening. Only its keeper may
   * (`ADVISE-403` for anyone else); a run not kept answers `ADVISE-404`. The reply names the run deleted.
   */
  deleteKeptRun: (runId: string) => api.post<{ runId: string }>('SourcingAdvisor/Runs/Delete', { runId }),
  /**
   * `GET SourcingAdvisor/Runs/Open?runId=` — a kept or comparison run, opened by its link (BackOffice 4380): the stored
   * record at the full level, solved again from its own copy. The stored plans are the truth; `openedAgain.samePlans` is
   * false when today's engine plans differently. A held working copy, or a run not there, answers `ADVISE-404`.
   */
  openRun: (runId: string) => api.get<AdviseReply>('SourcingAdvisor/Runs/Open', { runId }),
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
