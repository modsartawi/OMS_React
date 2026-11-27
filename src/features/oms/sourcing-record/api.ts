/**
 * The store record list's server call (ticket 969, BackOffice spec 4354 §14; BackOffice 4373), through `@/core/api`.
 * Wrapped in TanStack Query at the page.
 */
import { api } from '@/core/api'
import type { StoreRecordReply } from '@/core/models/sourcing-store-record'

export const recordApi = {
  /**
   * `GET SourcingAdvisor/StoreRecords` — every pair's stored record, as last night's pass left it (BackOffice 4373),
   * behind the simulator's run grant `BackOfficeScreen[SourcingSimulator, 03]`. Its `store` and `mode` narrowings are
   * not used: the list reads every pair once and tabs by mode.
   */
  storeRecords: () => api.get<StoreRecordReply>('SourcingAdvisor/StoreRecords'),
}

export const storeRecordQuery = () => ({
  queryKey: ['sourcing-record', 'store-record'] as const,
  queryFn: recordApi.storeRecords,
  // Rebuilt once a night (spec 4354 §14).
  staleTime: 10 * 60 * 1000,
  retry: false,
})
