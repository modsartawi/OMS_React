import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiErrorCode, apiErrorDetails } from '@/core/api'
import { campaignUploadPath } from '@/core/rules/campaign-state'
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
    const book = new File(['PK'], 'promotion.xlsx')
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
    const err = await campaignUploadApi.read(new File(['x'], 'promotion.xlsx')).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(apiErrorCode(err)).toBe('RULES_BAD_UPLOAD')
    expect((err as ApiError).message).toBe('The file is not a workbook.')
  })
})

describe('campaignUploadApi.convertBby', () => {
  it('POSTs the .txt as the multipart part `file` and saves under the reply’s name', async () => {
    const fetchStub = file('attachment; filename=0001000048-261009-261015.xlsx')
    vi.stubGlobal('fetch', fetchStub)
    const txt = new File(['BBY\t0001000048'], 'Same GRP - 50 Pct.txt', { type: 'text/plain' })
    const converted = await campaignUploadApi.convertBby(txt)
    expect(converted.fileName).toBe('0001000048-261009-261015.xlsx')
    expect(converted.blob).toBeInstanceOf(Blob)
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/Rules\/Authoring\/Uploads\/ConvertBby$/)
    expect(init.method).toBe('POST')
    const sent = (init.body as FormData).get('file') as File
    expect(sent).toBeInstanceOf(File)
    expect(sent.name).toBe('Same GRP - 50 Pct.txt')
  })

  it('falls back to campaign-upload.xlsx when the reply names none', async () => {
    vi.stubGlobal('fetch', file(null))
    expect((await campaignUploadApi.convertBby(new File(['x'], 'promotion.txt'))).fileName).toBe(CAMPAIGN_UPLOAD_FALLBACK_NAME)
  })

  it('throws RULES_BAD_UPLOAD as an ApiError with the server’s message', async () => {
    vi.stubGlobal(
      'fetch',
      json(400, {
        statusCode: 400,
        success: false,
        message: 'One upload is one SAP promotion number; this file holds 2: 0001000048, 0001000051.',
        errors: [{ errorCode: 'RULES_BAD_UPLOAD', internalErrorCode: '', errorMessage: 'One upload is one SAP promotion number; this file holds 2: 0001000048, 0001000051.' }],
        data: null,
      }),
    )
    const err = await campaignUploadApi.convertBby(new File(['x'], 'promotion.txt')).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(apiErrorCode(err)).toBe('RULES_BAD_UPLOAD')
    expect((err as ApiError).message).toBe('One upload is one SAP promotion number; this file holds 2: 0001000048, 0001000051.')
  })
})

describe('the approver’s doors (ticket 532)', () => {
  const ok = (data: unknown) => json(200, { statusCode: 200, success: true, message: '', errors: [], data })
  const sent = (fetchStub: ReturnType<typeof vi.fn>) => {
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit]
    return { url, method: init.method, body: JSON.parse(String(init.body)) as unknown }
  }

  it('List POSTs to Uploads/List and answers the summaries', async () => {
    const fetchStub = ok([{ promotionCode: 'P1' }])
    vi.stubGlobal('fetch', fetchStub)
    expect(await campaignUploadApi.list()).toEqual([{ promotionCode: 'P1' }])
    expect(sent(fetchStub)).toMatchObject({ method: 'POST', body: {} })
    expect(sent(fetchStub).url).toMatch(/Rules\/Authoring\/Uploads\/List$/)
  })

  it('Load POSTs { promotionCode } to Uploads/Load', async () => {
    const fetchStub = ok({ upload: { promotionCode: 'P1' }, campaigns: [], disabling: [], errors: [] })
    vi.stubGlobal('fetch', fetchStub)
    await campaignUploadApi.load('P1')
    expect(sent(fetchStub).url).toMatch(/Rules\/Authoring\/Uploads\/Load$/)
    expect(sent(fetchStub).body).toEqual({ promotionCode: 'P1' })
  })

  it('Activate sends the loaded revision, and the note only when it says something', async () => {
    const fetchStub = ok({ versionNo: 42 })
    vi.stubGlobal('fetch', fetchStub)
    await campaignUploadApi.activate({ promotionCode: 'P1', revision: 3, note: '   ' })
    expect(sent(fetchStub).url).toMatch(/Rules\/Authoring\/Uploads\/Activate$/)
    expect(sent(fetchStub).body).toEqual({ promotionCode: 'P1', revision: 3 })

    const noted = ok({ versionNo: 42 })
    vi.stubGlobal('fetch', noted)
    await campaignUploadApi.activate({ promotionCode: 'P1', revision: 3, note: ' Checked with the buyer. ' })
    expect(sent(noted).body).toEqual({ promotionCode: 'P1', revision: 3, note: 'Checked with the buyer.' })
  })

  it('Send back sends the note, trimmed', async () => {
    const fetchStub = ok({ promotionCode: 'P1', state: 'sentBack' })
    vi.stubGlobal('fetch', fetchStub)
    expect((await campaignUploadApi.sendBack({ promotionCode: 'P1', revision: 3, note: ' Wrong window. ' })).state).toBe('sentBack')
    expect(sent(fetchStub).url).toMatch(/Rules\/Authoring\/Uploads\/SendBack$/)
    expect(sent(fetchStub).body).toEqual({ promotionCode: 'P1', revision: 3, note: 'Wrong window.' })
  })

  it('RULES_INVALID_CAMPAIGN carries one detail per line after the refusal', async () => {
    vi.stubGlobal(
      'fetch',
      json(400, {
        statusCode: 400,
        success: false,
        message: 'The checker refuses the upload.',
        errors: [
          { errorCode: 'RULES_INVALID_CAMPAIGN', internalErrorCode: '', errorMessage: 'The checker refuses the upload.' },
          { errorCode: 'RULES_INVALID_CAMPAIGN', internalErrorCode: '', errorMessage: 'D1-OF1: rules[0]: no Value' },
        ],
        data: null,
      }),
    )
    const err = await campaignUploadApi.activate({ promotionCode: 'P1', revision: 3 }).catch((e: unknown) => e)
    expect(apiErrorCode(err)).toBe('RULES_INVALID_CAMPAIGN')
    expect(apiErrorDetails(err)).toEqual(['D1-OF1: rules[0]: no Value'])
  })

  it('an upload’s page escapes its promotion code', () => {
    expect(campaignUploadPath('0001000048-261009-261015')).toBe('/campaigns/uploads/0001000048-261009-261015')
    expect(campaignUploadPath('a/b')).toBe('/campaigns/uploads/a%2Fb')
  })
})
