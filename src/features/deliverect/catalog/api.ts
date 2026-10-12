import { api } from '@/core/api'
import type {
  DeliverectCatalogPushResult,
  DeliverectExclusionsBody,
  DeliverectWhitelistImportBody,
  DeliverectWhitelistImportResult,
  DeliverectWhitelistPage,
  DeliverectWhitelistQuery,
  DeliverectWhitelistUpdateBody,
} from '@/core/models/deliverect'

// The Deliverect catalog doors (BackOffice 2623; contract § Catalog). The area's shared reads — the
// access probe, the account list and the platform list — live in `@/core/deliverect/api`.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every whitelist read, whatever its filters — a write refreshes them all. */
export const WHITELIST_KEY = ['deliverect', 'whitelist'] as const

const materialPath = (door: 'Whitelist' | 'Exclusions', materialNumber: string) =>
  `DeliverectWeb/${door}/${encodeURIComponent(materialNumber)}`

export const catalogApi = {
  /** GET DeliverectWeb/Whitelist?q=&state=&skip=&take= — `take` is at most 500. */
  list(query: DeliverectWhitelistQuery): Promise<DeliverectWhitelistPage> {
    return api.get<DeliverectWhitelistPage>('DeliverectWeb/Whitelist', {
      q: query.q,
      state: query.state,
      skip: query.skip,
      take: query.take,
    })
  },

  /**
   * POST DeliverectWeb/Whitelist/Import — rows already present are re-activated; the answer counts
   * the added and re-activated ones and lists the unknown material numbers. Refusal: DLV-00012.
   */
  import(body: DeliverectWhitelistImportBody): Promise<DeliverectWhitelistImportResult> {
    return api.post<DeliverectWhitelistImportResult>('DeliverectWeb/Whitelist/Import', body)
  },

  /**
   * PUT DeliverectWeb/Whitelist/{materialNumber} — disable, delete or restore, with a reason. Its
   * answer is unspecified, so nothing is read from it (the list is refetched). DLV-00004.
   */
  update(materialNumber: string, body: DeliverectWhitelistUpdateBody): Promise<unknown> {
    return api.put<unknown>(materialPath('Whitelist', materialNumber), body)
  },

  /**
   * PUT DeliverectWeb/Exclusions/{materialNumber} — REPLACES the material's exclusion set (an empty
   * list re-enables every platform). Its answer is unspecified. Refusals: DLV-00004, DLV-00005.
   */
  setExclusions(materialNumber: string, body: DeliverectExclusionsBody): Promise<unknown> {
    return api.put<unknown>(materialPath('Exclusions', materialNumber), body)
  },

  /**
   * POST DeliverectWeb/Catalog/Push?account= — push the catalog to one Deliverect account now. The
   * contract names no body (and no reason): an empty JSON object is sent, as every body-less POST in
   * the app does. Refusal: DLV-00011 (Deliverect's answer in `message`).
   */
  push(account: string): Promise<DeliverectCatalogPushResult> {
    return api.post<DeliverectCatalogPushResult>('DeliverectWeb/Catalog/Push', {}, { account })
  },
}
