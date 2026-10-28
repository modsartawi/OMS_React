/**
 * Ticket 649 — the general upload doors (BackOffice 3193, the brief's sketch): the file goes as the multipart part
 * `file`; Apply posts `{ reason }` for that upload id. A null answer never applies. The network is stubbed at the
 * `@/core/api` boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), delWithBody: vi.fn(), upload: vi.fn(), blob: vi.fn() }))
vi.mock('@/core/api', () => ({ api }))

const { idfGeneralUploadApi } = await import('./api')

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(null)
})

describe('649 · the general upload doors', () => {
  it('uploads the file as the part `file` to general/uploads', async () => {
    const file = new File(['item,group,priority\n'], 'general.csv', { type: 'text/csv' })
    await idfGeneralUploadApi.upload(file)
    const [path, form] = api.upload.mock.calls[0]
    expect(path).toBe('IdfPriority/general/uploads')
    expect((form as FormData).get('file')).toBeInstanceOf(File)
    expect(((form as FormData).get('file') as File).name).toBe('general.csv')
  })
  it('a null answer is a report that never applies', async () => {
    const r = await idfGeneralUploadApi.upload(new File([''], 'x.csv'))
    expect(r).toEqual({ uploadId: '', ok: false, lineCount: null, rows: [], preview: null })
  })
  it('applies with the reason, the upload id encoded in the path', async () => {
    api.post.mockResolvedValue({ applied: 3, failedBatches: null })
    const r = await idfGeneralUploadApi.apply('GU/1', 'Price list of October')
    expect(api.post).toHaveBeenCalledWith('IdfPriority/general/uploads/GU%2F1/apply', { reason: 'Price list of October' })
    expect(r).toEqual({ applied: 3, failedBatches: [] })
  })
})
