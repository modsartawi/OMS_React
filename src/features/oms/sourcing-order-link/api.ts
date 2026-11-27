/**
 * The old order link's one door (ticket 974, BackOffice 4397): `GET SourcingAdvisor/Results/OrderRun?orderNumber=`,
 * under the advisor view grant (`SourcingAdvisor:01`), as every results door.
 */
import { api } from '@/core/api'
import type { ResultsOrderRunReply } from '@/core/models/sourcing-order-run'

export const orderLinkApi = {
  /** The order (or delivery) number's stored run, or none and whether a replay is offered. */
  orderRun: (orderNumber: string) => api.get<ResultsOrderRunReply>('SourcingAdvisor/Results/OrderRun', { orderNumber }),
}
