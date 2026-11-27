/**
 * The store record list's server call (ticket 969, BackOffice spec 4354 §14, BackOffice 4373), through `@/core/api`.
 * Wrapped in TanStack Query at the page. ⚠ The door does not exist yet (BackOffice 4373 open): the drive stubs it.
 */
import { api } from '@/core/api'
import type { StoreRecordReply } from '@/core/models/sourcing-store-record'

export const recordApi = {
  /**
   * Every pair's store record (BackOffice 4373: "A read door lists every pair's record for the simulator's store record
   * list"), under the run grant.
   * PROVISIONAL (spec 4354: not specified) — 4373 names the door but not its path: `SourcingAdvisor/StoreRecord` is ours.
   */
  storeRecord: () => api.get<StoreRecordReply>('SourcingAdvisor/StoreRecord'),
}

export const storeRecordQuery = () => ({
  queryKey: ['sourcing-record', 'store-record'] as const,
  queryFn: recordApi.storeRecord,
  // Rebuilt once a night (spec 4354 §14).
  staleTime: 10 * 60 * 1000,
  retry: false,
})
