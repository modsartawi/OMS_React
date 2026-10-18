import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiErrorCode } from '@/core/api'
import { CAMPAIGN_UPLOAD_FALLBACK_NAME, campaignUploadApi } from './api'

afterEach(() => vi.unstubAllGlobals())

const file = (disposition: string | null) =>
  vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    headers: new Headers(disposition ? { 'Content-Disposition': disposition } : {}),
    blob: async () => new Blob(['PK']),
    json: async () => {
      throw new SyntaxError('a workbook')
    },
  } as unknown as Response)

const json = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300, headers: new Headers(), json: async () => body } as unknown as Response)

describe('campaignUploadApi.template', () => {
  it('saves under the name the reply gives', async () => {
    const fetchStub = file('attachment; filename=campaign-upload-template.xlsx')
    vi.stubGlobal('fetch', fetchStub)
    expect((await campaignUploadApi.template()).fileName).toBe('campaign-upload-template.xlsx')
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/Rules\/Authoring\/Uploads\/Template$/)
    expect(init.method).toBe('POST')
  })

  it('falls back to campaign-upload.xlsx when the reply names none', async () => {
    vi.stubGlobal('fetch', file(null))
    expect((await campaignUploadApi.template()).fileName).toBe(CAMPAIGN_UPLOAD_FALLBACK_NAME)
    expect(CAMPAIGN_UPLOAD_FALLBACK_NAME).toBe('campaign-upload.xlsx')
  })
})

describe('campaignUploadApi.read', () => {
  it('sends the workbook as the multipart part `file` and answers the report', async () => {
    const fetchStub = json(200, { statusCode: 200, success: true, message: '', errors: [], data: { accepted: false } })
    vi.stubGlobal('fetch', fetchStub)
    const book = new File(['PK'], 'deal.xlsx')
    expect(await campaignUploadApi.read(book)).toEqual({ accepted: false })
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/Rules\/Authoring\/Uploads\/Read$/)
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
  })

  it('throws RULES_BAD_UPLOAD as an ApiError with the message', async () => {
    vi.stubGlobal(
      'fetch',
      json(400, {
        statusCode: 400,
        success: false,
        message: 'The file is not a workbook.',
        errors: [{ errorCode: 'RULES_BAD_UPLOAD', internalErrorCode: '', errorMessage: 'The file is not a workbook.' }],
        data: null,
      }),
    )
    const err = await campaignUploadApi.read(new File(['x'], 'deal.xlsx')).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(apiErrorCode(err)).toBe('RULES_BAD_UPLOAD')
    expect((err as ApiError).message).toBe('The file is not a workbook.')
  })
})
