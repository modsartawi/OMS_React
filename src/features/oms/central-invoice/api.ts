/**
 * The central-invoice list's server call (ticket 333, BackOffice 2100). The raise and the
 * shared probe are `@/core/central-invoice/api`'s, because the delivery page makes them too;
 * this read has one consumer, so it stays here.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 */
import { api } from '@/core/api'
import type { CentralInvoiceListResponse, CentralInvoiceListRow } from '@/core/models/central-invoice'
import { listParams, type CentralInvoiceListCriteria } from './list-criteria'

export const centralInvoiceListApi = {
  /**
   * `GET Sd/CentralInvoice` → the raised central invoices, newest request first.
   *
   * Behind the same `CentralInvoice` grant as the raise: without it, a bare 403. A filter
   * the server cannot read is the standard 400 (`CINV-LIST-FILTER`) with its sentence.
   */
  async list(criteria: CentralInvoiceListCriteria): Promise<CentralInvoiceListRow[]> {
    const data = await api.get<CentralInvoiceListResponse>('Sd/CentralInvoice', listParams(criteria))
    return (data?.rows ?? []).map((row) => ({ ...row, serials: row.serials ?? [] }))
  },
}
