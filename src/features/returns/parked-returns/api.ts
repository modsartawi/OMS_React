/**
 * The parked-returns doors (BackOffice ticket 4224; contract BackOffice 4218: `RefundLedgerWeb/ParkedReturns...`, both
 * behind `ParkedReturns.View`). Every call goes through `@/core/api` (api-envelope rule); every answer is read field by
 * field (`./wire`). View only: no write door is called from this ticket.
 */
import { api } from '@/core/api'
import type { ParkedReturnDetail, ParkedReturnsPage, ParkedReturnsQuery } from '@/core/models/parked-returns'
import { readDetail, readListPage } from './wire'

const LIST = 'RefundLedgerWeb/ParkedReturns'

/** Every read sits under this prefix. */
export const PARKED_RETURNS_KEY = ['parked-returns'] as const
export const listKey = (query: ParkedReturnsQuery) => [...PARKED_RETURNS_KEY, 'list', query] as const
export const detailKey = (transactionId: string) => [...PARKED_RETURNS_KEY, 'detail', transactionId] as const

export const parkedReturnsApi = {
  /** `GET RefundLedgerWeb/ParkedReturns` — a page of the list, in the server's order (needs HQ first, then the oldest). */
  async list(query: ParkedReturnsQuery): Promise<ParkedReturnsPage> {
    return readListPage(await api.get<unknown>(LIST, { ...query }))
  },

  /** `GET RefundLedgerWeb/ParkedReturns/{transactionId}` — the mirrored return and its ledger grains (404 when unknown). */
  async detail(transactionId: string): Promise<ParkedReturnDetail> {
    return readDetail(await api.get<unknown>(`${LIST}/${encodeURIComponent(transactionId.trim())}`))
  },
}
