/**
 * Ticket 628 — the IDF doors send and read the shapes 3161–3169 built (the brief's `## Changes`), not the brief's
 * first sketch: a master's payer key is `insurerCustomerId`; a store list is created with `{ code, nameEn, nameAr }`
 * and renamed with `{ nameEn, nameAr }` (there is no delete door); an exception's DELETE carries `{ reason }` in its
 * BODY; the lookup's `payer=` is the insurer's customer id beside the optional sub-document and Nphies claim types;
 * the events page is `{ page, pageSize, total, rows }`. The network is stubbed at the `@/core/api` boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), delWithBody: vi.fn(), upload: vi.fn(), blob: vi.fn() }))
vi.mock('@/core/api', () => ({ api }))

const { idfEventsApi, idfExceptionsApi, idfLookupApi, idfMasterFormApi, idfStoreListsApi } = await import('./api')
const { masterBody, newMasterForm } = await import('./master-form')
const { exceptionBody, EMPTY_EXCEPTION_FORM } = await import('./exceptions')
const { readIdfEventsQuery } = await import('./events-filter')

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(null)
})

describe('the IDF doors send the shapes the BackOffice tickets built', () => {
  it('a master create posts insurerCustomerId, never payerCode', async () => {
    const body = masterBody({ ...newMasterForm('insurer'), insurerCustomerId: '0001100336', nameEn: 'Bupa', nameAr: 'بوبا' })
    await idfMasterFormApi.create(body)
    expect(api.post).toHaveBeenCalledWith('IdfPriority/masters', {
      kind: 'insurer',
      insurerCustomerId: '0001100336',
      storeListId: null,
      nameEn: 'Bupa',
      nameAr: 'بوبا',
      hardThreshold: 4,
      reminderThreshold: 1,
    })
  })

  it('a store list is created with its code and both names, renamed with both names; no delete door is offered', async () => {
    await idfStoreListsApi.create({ code: 'OPS-EAST', nameEn: 'East operation', nameAr: 'تشغيل الشرقية' })
    expect(api.post).toHaveBeenCalledWith('IdfPriority/store-lists', { code: 'OPS-EAST', nameEn: 'East operation', nameAr: 'تشغيل الشرقية' })
    await idfStoreListsApi.rename('SL 1', { nameEn: 'East', nameAr: 'الشرقية' })
    expect(api.put).toHaveBeenCalledWith('IdfPriority/store-lists/SL%201', { nameEn: 'East', nameAr: 'الشرقية' })
    expect('remove' in idfStoreListsApi).toBe(false)
  })

  it('an exception save carries allStores; its DELETE carries the reason in the body', async () => {
    await idfExceptionsApi.add(exceptionBody({ ...EMPTY_EXCEPTION_FORM, key: 'InsuranceOrder', allStores: true, reason: 'Contract' }))
    expect(api.post).toHaveBeenCalledWith('IdfPriority/exceptions', { keyKind: 'documentType', key: 'InsuranceOrder', handling: 'skip', masterId: null, allStores: true, reason: 'Contract' })
    await idfExceptionsApi.remove('X-1', 'No longer needed')
    expect(api.delWithBody).toHaveBeenCalledWith('IdfPriority/exceptions/X-1', { reason: 'No longer needed' })
    expect(api.del).not.toHaveBeenCalled()
  })

  it('the lookup sends payer = the insurer customer id, and the optional sub-document and Nphies claim types', async () => {
    await idfLookupApi.lookup({ item: '100300', store: 'P019', payer: '0001100336', documentType: '', subDocumentType: 'SABIC', nphiesClaimType: '3' })
    expect(api.get).toHaveBeenCalledWith('IdfPriority/lookup', {
      item: '100300',
      store: 'P019',
      payer: '0001100336',
      documentType: '',
      subDocumentType: 'SABIC',
      nphiesClaimType: '3',
    })
  })

  it('the events page reads { page, pageSize, total, rows }; a missing body is an empty page', async () => {
    const q = readIdfEventsQuery(new URLSearchParams('payer=0001100336&outcome=alternativeTaken&page=2'), '2026-10-27')
    api.get.mockResolvedValue({ page: 2, pageSize: 50, total: 51, rows: [{ eventId: 'E-1' }] })
    expect(await idfEventsApi.events(q)).toEqual({ page: 2, pageSize: 50, total: 51, rows: [{ eventId: 'E-1' }] })
    expect(api.get).toHaveBeenCalledWith('IdfPriority/events', expect.objectContaining({ payer: '0001100336', outcome: 'alternativeTaken', page: '2' }))
    api.get.mockResolvedValue(null)
    expect(await idfEventsApi.events(q)).toEqual({ page: 2, pageSize: 0, total: 0, rows: [] })
  })
})
