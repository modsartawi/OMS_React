/**
 * The delivery statistics page's server call (ticket 484, BackOffice 2641). The probe is the shared
 * OMS one (`@/core/oms/api`); this read has one consumer, so it stays here.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 */
import { api } from '@/core/api'
import type { DeliveryStatistics, StoreStatisticsQuery } from '@/core/models/delivery-statistics'

export const deliveryStatisticsApi = {
  /**
   * `GET SdDocumentWeb/StoreStatistics` → the period's figures, its series and every store's own.
   * 🚩 The door is BackOffice 2641 and is NOT built: this is written against the brief's agreed
   * shape, and ticket 488 confirms it live. A range over 31 days comes back as the business
   * refusal `SDD-02131`, an invalid query as `SDD-02132`; both are shown in the server's words.
   *
   * The answer is passed through as sent — a figure the server leaves out stays out (it reads
   * "—"). Only a missing band or list is read as empty, so a bare answer draws dashes, not a crash.
   */
  async read(params: StoreStatisticsQuery): Promise<DeliveryStatistics> {
    const data = await api.get<Partial<DeliveryStatistics> | null>('SdDocumentWeb/StoreStatistics', params)
    return {
      asOf: data?.asOf ?? null,
      flow: data?.flow ?? {},
      misses: data?.misses ?? {},
      avgHandOverMinutes: data?.avgHandOverMinutes ?? null,
      series: data?.series ?? [],
      // Passed through as sent (brief 2660): an older server's absent split stays absent and reads "—".
      tracks: data?.tracks ?? undefined,
      unspecified: data?.unspecified ?? undefined,
      stores: data?.stores ?? [],
    }
  },
}
