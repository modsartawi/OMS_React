/**
 * Ticket 652 — the IDF groups doors (BackOffice 3196, the brief's "Spec 3185" sketch): the paged list asks
 * `search=&page=`, an add posts the number, an edit PUTs only description + dosage form, a remove is a plain DELETE
 * (no body), and the export / template are `api.blob` reads. Stubbed at the `@/core/api` boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), delWithBody: vi.fn(), upload: vi.fn(), blob: vi.fn() }))
vi.mock('@/core/api', () => ({ api }))

const { idfGroupsApi, idfGroupsImportApi } = await import('./api') // 653: idfGroupsImportApi

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(null)
})

describe('the IDF groups doors', () => {
  it('the list asks search and page and reads { page, pageSize, total, rows }; a missing body is an empty page', async () => {
    api.get.mockResolvedValue({ page: 2, pageSize: 50, total: 51, rows: [{ idfNumber: 'IDF-1', description: 'Para', dosageForm: 'Tablet', itemCount: 3 }] })
    expect((await idfGroupsApi.list({ q: 'para', page: 2 })).total).toBe(51)
    expect(api.get).toHaveBeenCalledWith('IdfPriority/groups', { search: 'para', page: '2' })
    api.get.mockResolvedValue(null)
    expect(await idfGroupsApi.list({ q: '', page: 1 })).toEqual({ page: 1, pageSize: 0, total: 0, rows: [] })
  })
  it('add posts the number; edit PUTs description and dosage form under the number; remove is a bodiless DELETE', async () => {
    await idfGroupsApi.add({ idfNumber: 'IDF 9', description: 'Amox', dosageForm: 'Syrup' })
    expect(api.post).toHaveBeenCalledWith('IdfPriority/groups', { idfNumber: 'IDF 9', description: 'Amox', dosageForm: 'Syrup' })
    await idfGroupsApi.edit('IDF 9', { description: 'Amoxicillin', dosageForm: 'Syrup' })
    expect(api.put).toHaveBeenCalledWith('IdfPriority/groups/IDF%209', { description: 'Amoxicillin', dosageForm: 'Syrup' })
    await idfGroupsApi.remove('IDF 9')
    expect(api.del).toHaveBeenCalledWith('IdfPriority/groups/IDF%209')
    expect(api.delWithBody).not.toHaveBeenCalled()
  })
  it('export and template are file reads', async () => {
    await idfGroupsApi.export()
    expect(api.blob).toHaveBeenCalledWith('IdfPriority/groups/export')
    await idfGroupsApi.template()
    expect(api.blob).toHaveBeenCalledWith('IdfPriority/groups/template')
  })
})

// 653 · the groups import doors (3197)
describe('the IDF groups import doors', () => {
  it('upload posts the file as the multipart part `file`; a missing body is a report that never applies', async () => {
    const report = { uploadId: 'G-1', ok: true, rows: [{ line: 2, idfNumber: 'IDF-0600', action: 'add', rule: '', messageEn: '', messageAr: '' }] }
    api.upload.mockResolvedValue(report)
    const file = new File(['idf,description,dosage form'], 'groups.csv', { type: 'text/csv' })
    expect(await idfGroupsImportApi.upload(file)).toEqual(report)
    const [path, form] = api.upload.mock.calls[0]
    expect(path).toBe('IdfPriority/groups/uploads')
    expect((form as FormData).get('file')).toBeInstanceOf(File)
    api.upload.mockResolvedValue(null)
    expect(await idfGroupsImportApi.upload(file)).toEqual({ uploadId: '', ok: false, rows: [] })
  })
  it('apply posts an empty body under the upload id and reads { added, updated }', async () => {
    api.post.mockResolvedValue({ added: 2, updated: 1 })
    expect(await idfGroupsImportApi.apply('G 1')).toEqual({ added: 2, updated: 1 })
    expect(api.post).toHaveBeenCalledWith('IdfPriority/groups/uploads/G%201/apply', {})
  })
})
