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

// 643 · a version's items (3187)
describe('643 · the entries door', () => {
  it('reads one page of a version, search and group as the door names them, and fills a null body', async () => {
    const { idfEntriesApi } = await import('./api')
    api.get.mockResolvedValueOnce({ page: 2, pageSize: 25, total: 60, rows: [{ itemNumber: '100200', descriptionEn: 'Panadol', descriptionAr: '', idfNumber: 'IDF-PARA-500', priority: 1 }] })
    const page = await idfEntriesApi.entries('M BUPA', 'V/11', { q: 'pan', idf: 'IDF-PARA-500', page: 2 })
    expect(api.get).toHaveBeenCalledWith('IdfPriority/masters/M%20BUPA/versions/V%2F11/entries', { search: 'pan', idf: 'IDF-PARA-500', page: '2' })
    expect(page.total).toBe(60)
    expect(await idfEntriesApi.entries('M-OPS', 'V-4', { q: '', idf: '', page: 3 })).toEqual({ page: 3, pageSize: 0, total: 0, rows: [] })
  })
})

// 644 · master export + template (3188)
describe('644 · the master export and template doors', () => {
  it('export reads the version as a file; template reads the blank file', async () => {
    const { idfMasterFilesApi } = await import('./api')
    await idfMasterFilesApi.export('M BUPA', 'V/11')
    expect(api.blob).toHaveBeenCalledWith('IdfPriority/masters/M%20BUPA/versions/V%2F11/export')
    await idfMasterFilesApi.template()
    expect(api.blob).toHaveBeenCalledWith('IdfPriority/masters/template')
  })
})

// 645 · a master's draft (3189)
describe('645 · the draft doors', () => {
  it('reads, starts, edits, publishes and discards the draft at its paths', async () => {
    const { idfDraftApi } = await import('./api')
    expect(await idfDraftApi.draft('M BUPA')).toBeNull()
    expect(api.get).toHaveBeenCalledWith('IdfPriority/masters/M%20BUPA/draft')
    await idfDraftApi.start('M-BUPA')
    expect(api.post).toHaveBeenLastCalledWith('IdfPriority/masters/M-BUPA/draft', {})
    await idfDraftApi.add('M-BUPA', { itemNumber: '100999', idfNumber: 'IDF-PARA-500', priority: 4 })
    expect(api.post).toHaveBeenLastCalledWith('IdfPriority/masters/M-BUPA/draft/items', { itemNumber: '100999', idfNumber: 'IDF-PARA-500', priority: 4 })
    await idfDraftApi.reRank('M-BUPA', '100/300', 3)
    expect(api.put).toHaveBeenLastCalledWith('IdfPriority/masters/M-BUPA/draft/items/100%2F300', { priority: 3 })
    await idfDraftApi.remove('M-BUPA', '200100')
    expect(api.del).toHaveBeenLastCalledWith('IdfPriority/masters/M-BUPA/draft/items/200100')
    await idfDraftApi.publish('M-BUPA', 'Three edits')
    expect(api.post).toHaveBeenLastCalledWith('IdfPriority/masters/M-BUPA/draft/publish', { note: 'Three edits' })
    await idfDraftApi.discard('M-BUPA')
    expect(api.del).toHaveBeenLastCalledWith('IdfPriority/masters/M-BUPA/draft')
  })

  it('reads every row of the base version, page after page, for the diff', async () => {
    const { idfDraftApi } = await import('./api')
    const r = (n: number) => ({ itemNumber: String(n), descriptionEn: '', descriptionAr: '', idfNumber: 'G', priority: 1 })
    api.get
      .mockResolvedValueOnce({ page: 1, pageSize: 2, total: 5, rows: [r(1), r(2)] })
      .mockResolvedValueOnce({ page: 2, pageSize: 2, total: 5, rows: [r(3), r(4)] })
      .mockResolvedValueOnce({ page: 3, pageSize: 2, total: 5, rows: [r(5)] })
    const rows = await idfDraftApi.baseRows('M-BUPA', 'V-11')
    expect(rows.map((x) => x.itemNumber)).toEqual(['1', '2', '3', '4', '5'])
    expect(api.get).toHaveBeenNthCalledWith(1, 'IdfPriority/masters/M-BUPA/versions/V-11/entries', { page: '1', pageSize: '500' })
    expect(api.get).toHaveBeenNthCalledWith(3, 'IdfPriority/masters/M-BUPA/versions/V-11/entries', { page: '3', pageSize: '500' })
  })

  it('stops on an empty page even when the total says more', async () => {
    const { idfDraftApi } = await import('./api')
    api.get.mockResolvedValueOnce({ page: 1, pageSize: 1, total: 9, rows: [{ itemNumber: '1', idfNumber: 'G', priority: 1 }] }).mockResolvedValueOnce({ page: 2, pageSize: 1, total: 9, rows: [] })
    expect((await idfDraftApi.baseRows('M-BUPA', 'V-11')).length).toBe(1)
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})

// 647 · the general master's items (3191)
describe('647 · the general items door', () => {
  it('reads one page of the general items, search and group as the door names them, and fills a null body', async () => {
    const { idfGeneralApi } = await import('./api')
    api.get.mockResolvedValueOnce({ page: 1, pageSize: 25, total: 2, rows: [{ itemNumber: '100200', descriptionEn: 'Panadol', descriptionAr: '', idfNumber: 'IDF-PARA-500', priority: 1 }] })
    const page = await idfGeneralApi.items({ q: 'pan', idf: 'IDF-PARA-500', page: 1 })
    expect(api.get).toHaveBeenCalledWith('IdfPriority/general/items', { search: 'pan', idf: 'IDF-PARA-500', page: '1' })
    expect(page.rows).toHaveLength(1)
    expect(await idfGeneralApi.items({ q: '', idf: '', page: 2 })).toEqual({ page: 2, pageSize: 0, total: 0, rows: [] })
  })
})

// 648 · set / clear one general item (3192)
describe('648 · the general item edit doors', () => {
  it('sets an item with PUT { idfNumber, priority, reason } and clears it with DELETE { reason } in the body', async () => {
    const { idfGeneralEditApi } = await import('./api')
    await idfGeneralEditApi.set('300 110', { idfNumber: 'IDF-IBU', priority: 3, reason: 'Re-ranked' })
    expect(api.put).toHaveBeenCalledWith('IdfPriority/general/items/300%20110', { idfNumber: 'IDF-IBU', priority: 3, reason: 'Re-ranked' })
    await idfGeneralEditApi.clear('300110', 'Withdrawn')
    expect(api.delWithBody).toHaveBeenCalledWith('IdfPriority/general/items/300110', { reason: 'Withdrawn' })
  })
})
