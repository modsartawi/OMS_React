/**
 * The weight-set screens' server calls (ticket 967, BackOffice spec 4354 §10), through `@/core/api`. Wrapped in
 * TanStack Query at the page. ⚠ None of these doors exists yet (BackOffice 4360 and 4395 open): the drive stubs them.
 * The list and a version are the doors the simulator's picker already reads (ticket 963).
 */
import { api } from '@/core/api'
import type { WeightSetListItem, WeightSetVersion, WeightSetVersionRef } from '@/core/models/sourcing-run'
import type { CandidateLogEntry, MarkingReply, MarkRequest } from '@/core/models/sourcing-sets'

export const sourcingSetsApi = {
  /**
   * The sets and their versions (BackOffice 4360 "list sets and versions").
   * PROVISIONAL (spec 4354: not specified) — the path `SourcingAdvisor/WeightSets` (ticket 963's) and the list's fields.
   */
  sets: () => api.get<WeightSetListItem[]>('SourcingAdvisor/WeightSets'),
  /**
   * One saved version, read whole (BackOffice 4360 "read a version").
   * PROVISIONAL (spec 4354: not specified) — the path `SourcingAdvisor/WeightSets/Version` and its params (ticket 963's).
   */
  version: (ref: WeightSetVersionRef) =>
    api.get<WeightSetVersion>('SourcingAdvisor/WeightSets/Version', {
      name: ref.name,
      version: ref.version,
    }),
  /**
   * The candidate log, newest first (BackOffice 4360 "read the candidate log", with the trial's figures of BO 4395).
   * PROVISIONAL (spec 4354: not specified) — the door's path `SourcingAdvisor/WeightSets/CandidateLog` and its reply.
   */
  log: () => api.get<CandidateLogEntry[]>('SourcingAdvisor/WeightSets/CandidateLog'),
  /**
   * What the marking screen shows for one version before a marking (BO 4395: "the marking door answers what the
   * marking screen shows").
   * PROVISIONAL (spec 4354: not specified) — the door, its path `SourcingAdvisor/WeightSets/Marking` and its query.
   */
  marking: (ref: WeightSetVersionRef) =>
    api.get<MarkingReply>('SourcingAdvisor/WeightSets/Marking', {
      name: ref.name,
      version: ref.version,
    }),
  /**
   * Mark the version as the candidate set, under the marking grant (BO 4360 "mark"). Answers the new log row; a refusal
   * carries one error per reason (`MarkingRefusal`).
   * PROVISIONAL (spec 4354: not specified) — the door, its path `SourcingAdvisor/WeightSets/Mark`, its body and its codes.
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

export const markingQuery = (ref: WeightSetVersionRef | null) => ({
  queryKey: ['sourcing-sets', 'marking', ref?.name ?? '', ref?.version ?? 0] as const,
  queryFn: () => sourcingSetsApi.marking(ref!),
  enabled: !!ref,
  retry: false,
})
