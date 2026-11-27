/**
 * The weight-set screens' server calls (ticket 967, BackOffice spec 4354 §10), through `@/core/api`. Wrapped in
 * TanStack Query at the page. Reconciled with BackOffice 4360 / 4395 at pricing2 35a4e56be (`WeightSetEndpoints`):
 * the list, a version and the candidate log under the run grant; the marking screen and the mark under the mark grant.
 *
 * Not called here: `POST SourcingAdvisor/WeightSets/Save` (a new version of a set one owns), `/Copy` (the simulator's
 * "Save as a named set" calls it) and `/Retire` — ticket 967 lists no such action on these screens.
 */
import { api } from '@/core/api'
import type { WeightSetListItem, WeightSetVersion, WeightSetVersionRef } from '@/core/models/sourcing-run'
import type { CandidateLogEntry, MarkRequest, MarkScreenReply } from '@/core/models/sourcing-sets'

export const sourcingSetsApi = {
  /** `GET SourcingAdvisor/WeightSets?withRetired=true` — every set and its versions, the retired ones too (shown retired). */
  sets: () => api.get<WeightSetListItem[]>('SourcingAdvisor/WeightSets', { withRetired: 'true' }),
  /** `GET SourcingAdvisor/WeightSets/Version?name=&version=` — one saved version, read whole. */
  version: (ref: WeightSetVersionRef) => api.get<WeightSetVersion>('SourcingAdvisor/WeightSets/Version', { name: ref.name, version: ref.version }),
  /** `GET SourcingAdvisor/WeightSets/CandidateLog` — every marking, newest first, with what its screen showed. */
  log: () => api.get<CandidateLogEntry[]>('SourcingAdvisor/WeightSets/CandidateLog'),
  /** `GET SourcingAdvisor/WeightSets/MarkScreen?name=&version=` — the checks, the trial and the shelf chance figures. */
  markScreen: (ref: WeightSetVersionRef) => api.get<MarkScreenReply>('SourcingAdvisor/WeightSets/MarkScreen', { name: ref.name, version: ref.version }),
  /**
   * `POST SourcingAdvisor/WeightSets/Mark` — mark the version as the candidate set, with a written reason. Answers the
   * new log row; refused with `WEIGHTSET-423` and every reason in `data.refusals`.
   */
  mark: (body: MarkRequest) => api.post<CandidateLogEntry>('SourcingAdvisor/WeightSets/Mark', body),
}

export const setsQuery = () => ({
  queryKey: ['sourcing-sets', 'sets'] as const,
  queryFn: sourcingSetsApi.sets,
  retry: false,
})

export const versionQuery = (ref: WeightSetVersionRef) => ({
  queryKey: ['sourcing-sets', 'version', ref.name, ref.version] as const,
  queryFn: () => sourcingSetsApi.version(ref),
  // A saved version is never edited (spec 4354 §10).
  staleTime: Infinity,
  retry: false,
})

export const logQuery = () => ({
  queryKey: ['sourcing-sets', 'log'] as const,
  queryFn: sourcingSetsApi.log,
  retry: false,
})

export const markScreenQuery = (ref: WeightSetVersionRef | null) => ({
  queryKey: ['sourcing-sets', 'mark-screen', ref?.name ?? '', ref?.version ?? 0] as const,
  queryFn: () => sourcingSetsApi.markScreen(ref!),
  enabled: !!ref,
  retry: false,
})
