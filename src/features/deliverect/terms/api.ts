import { api } from '@/core/api'
import type { DeliverectPlatformBody, DeliverectTermsBody, DeliverectTermsRow } from '@/core/models/deliverect'

// The delivery platforms and terms doors (BackOffice 2627; contract § Platforms and terms). The
// Accounts and Platforms reads are shared with the stores and catalog pages, so they live in
// `@/core/deliverect/api`; this file holds the doors only this page calls.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every terms read, whatever its platform — a new row refreshes them all. */
export const TERMS_KEY = ['deliverect', 'terms'] as const

export const termsApi = {
  /** GET DeliverectWeb/Terms?platform= — the platform's rows, never edited or deleted. */
  list(platform: string): Promise<DeliverectTermsRow[]> {
    return api.get<DeliverectTermsRow[]>('DeliverectWeb/Terms', { platform })
  },

  /**
   * POST DeliverectWeb/Terms — the row without `termsId` and `validTo`, plus `reason`. It closes the
   * previous open row the day before `validFrom`. Its answer is unspecified, so nothing is read from
   * it (the timeline is refetched). Refusal: DLV-00008.
   */
  add(body: DeliverectTermsBody): Promise<unknown> {
    return api.post<unknown>('DeliverectWeb/Terms', body)
  },

  /**
   * PUT DeliverectWeb/Platforms/{platformKey} — `{ displayName, channelId, creditCustomer, active,
   * reason }`. Its answer is unspecified (the list is refetched); the contract lists no refusal.
   */
  updatePlatform(platformKey: string, body: DeliverectPlatformBody): Promise<unknown> {
    return api.put<unknown>(`DeliverectWeb/Platforms/${encodeURIComponent(platformKey)}`, body)
  },
}
