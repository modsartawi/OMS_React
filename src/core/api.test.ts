/**
 * The envelope's edge cases at the boundary that maps them — the one rule that
 * cannot be asserted from a feature, because a feature only ever sees the
 * `ApiError` this module already decided on.
 *
 * 🚩 The subject is the **coded refusal that arrives with a 5xx status**. A
 * service can answer a deliberate, named outcome with a 503 — a downstream it
 * depends on being briefly unavailable — and the screen has to be able to tell
 * that from a crash: one is *try again, nothing is wrong*, the other is *something
 * unexpected happened*. The call-center console's `SUBMIT_UNAVAILABLE` (503
 * carrying the envelope) is the case that forced this to be written down, and a
 * regression here would surface there as a routine retry reading as a fault
 * mid-call.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, apiErrorAttemptId, apiErrorCode } from './api'

/** One `fetch` answer — the SIS.Api envelope verbatim, at whatever status. */
const answer = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response)

const envelope = (status: number, errorCode: string | null, message = 'the service said so') => ({
  statusCode: status,
  success: false,
  message,
  errors: errorCode ? [{ errorCode, internalErrorCode: '', errorMessage: '' }] : [],
  data: { field: 'slot' },
})

afterEach(() => vi.unstubAllGlobals())

const failing = async (status: number, body: unknown): Promise<ApiError> => {
  vi.stubGlobal('fetch', answer(status, body))
  try {
    await api.get('Anything')
  } catch (err) {
    return err as ApiError
  }
  throw new Error('expected a throw')
}

describe('a non-2xx carrying the envelope', () => {
  it('stays a business outcome even at 5xx, when it is CODED', async () => {
    const err = await failing(503, envelope(503, 'SUBMIT_UNAVAILABLE', 'The order is safe — try again.'))
    expect(err.kind).toBe('business')
    // The server's own sentence and code both survive — the screen needs the
    // code to branch and the sentence to say.
    expect(apiErrorCode(err)).toBe('SUBMIT_UNAVAILABLE')
    expect(err.message).toBe('The order is safe — try again.')
    // ...and the refusal's own body, which is how a refusal names a field.
    expect(err.data).toEqual({ field: 'slot' })
  })

  it('is still a server fault at 5xx when it carries no code', async () => {
    // A genuine crash, and the generic sentence that goes with it. This is the
    // case the coded branch must NOT swallow.
    const err = await failing(500, envelope(500, null))
    expect(err.kind).toBe('server')
    expect(err.message).not.toBe('the service said so')
  })

  it('is a server fault at 5xx with no envelope at all', async () => {
    const err = await failing(502, 'not json at all')
    expect(err.kind).toBe('server')
  })

  it('is a business outcome at the ordinary refusal statuses', async () => {
    for (const status of [400, 403, 404, 409]) {
      const err = await failing(status, envelope(status, 'SOME_RULE'))
      expect(err.kind, `status ${status}`).toBe('business')
      expect(apiErrorCode(err)).toBe('SOME_RULE')
    }
  })
})

/**
 * `attemptId` — the render rail's support handle (ticket 262). A **top-level
 * sibling** of `message`/`errors`, so a reader that dug through `errors[]` would
 * find nothing; present on 422/504 and absent everywhere else.
 */
describe('apiErrorAttemptId', () => {
  it('reads the envelope-level attemptId off a refusal that carried one', async () => {
    const err = await failing(422, { ...envelope(422, 'RENDER_FAILED'), attemptId: '01J8ZC9K3M7Q' })
    expect(apiErrorAttemptId(err)).toBe('01J8ZC9K3M7Q')
  })

  it('is null for a refusal without one, and for a value that is not an ApiError', async () => {
    expect(apiErrorAttemptId(await failing(503, envelope(503, 'RENDERER_UNAVAILABLE')))).toBeNull()
    expect(apiErrorAttemptId(new Error('a plain bug'))).toBeNull()
    expect(apiErrorAttemptId(null)).toBeNull()
  })
})

/**
 * `api.blob` — the binary door (ticket 262). Its whole subject is that **success
 * and failure read different body types off the same response**: a 2xx is raw
 * bytes, and every failure is the envelope `api.get` already maps.
 */
describe('api.blob', () => {
  /** One `fetch` answer carrying a file rather than an envelope. */
  const fileAnswer = (blob: Blob, disposition: string | null) =>
    vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(disposition ? { 'Content-Disposition': disposition } : {}),
      blob: async () => blob,
      json: async () => {
        throw new SyntaxError('the body is a PDF, not JSON')
      },
    } as unknown as Response)

  it('returns the bytes and the server-given name on a 2xx', async () => {
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    const fetchStub = fileAnswer(pdf, 'attachment; filename="Invoice-P001-01-00114600051234.pdf"')
    vi.stubGlobal('fetch', fetchStub)

    const file = await api.blob('RetailInvoice/Download', {
      storeCode: 'P001',
      machineCode: '01',
      trxNumber: '00114600051234',
    })

    expect(file.blob).toBe(pdf)
    expect(file.filename).toBe('Invoice-P001-01-00114600051234.pdf')
    // The same door as `get`: query params on the URL, the CSRF header the cookie
    // branch requires, and same-origin credentials.
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('RetailInvoice/Download?storeCode=P001&machineCode=01&trxNumber=00114600051234')
    expect(init.credentials).toBe('same-origin')
    expect((init.headers as Record<string, string>)['X-Web-Client']).toBe('1')
  })

  it('leaves the filename null when the response names none', async () => {
    vi.stubGlobal('fetch', fileAnswer(new Blob(['%PDF-1.4']), null))
    expect((await api.blob('RetailInvoice/Download')).filename).toBeNull()
  })

  // A refusal wearing a success status — the estate answers some business outcomes
  // with `200 success:false`, and saving THAT to disk as the "PDF" is a failure
  // nobody sees until they open the file.
  it('refuses a 2xx that came back as a JSON envelope rather than bytes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers({ 'Content-Type': 'application/json; charset=utf-8' }),
        json: async () => ({ ...envelope(200, 'RENDER_FAILED'), attemptId: '01J8ZE' }),
        blob: async () => new Blob(['{"success":false}']),
      } as unknown as Response),
    )

    const err = await api.blob('RetailInvoice/Download').catch((e: unknown) => e as ApiError)
    expect(err).toBeInstanceOf(ApiError)
    expect(apiErrorCode(err)).toBe('RENDER_FAILED')
    expect(apiErrorAttemptId(err)).toBe('01J8ZE')
  })

  const failingBlob = async (status: number, body: unknown): Promise<ApiError> => {
    vi.stubGlobal('fetch', answer(status, body))
    try {
      await api.blob('RetailInvoice/Download')
    } catch (err) {
      return err as ApiError
    }
    throw new Error('expected a throw')
  }

  it('throws the same ApiError shape as api.get on a coded refusal', async () => {
    const err = await failingBlob(422, { ...envelope(422, 'RENDER_FAILED'), attemptId: '01J8ZC9K3M7Q' })
    expect(err.kind).toBe('business')
    expect(apiErrorCode(err)).toBe('RENDER_FAILED')
    expect(err.statusCode).toBe(422)
    expect(apiErrorAttemptId(err)).toBe('01J8ZC9K3M7Q')
  })

  it('keeps 503 and 504 apart, both as their own coded refusals', async () => {
    const unavailable = await failingBlob(503, envelope(503, 'RENDERER_UNAVAILABLE'))
    const timeout = await failingBlob(504, { ...envelope(504, 'RENDER_TIMEOUT'), attemptId: '01J8ZD' })
    expect(apiErrorCode(unavailable)).toBe('RENDERER_UNAVAILABLE')
    expect(apiErrorCode(timeout)).toBe('RENDER_TIMEOUT')
    expect(apiErrorAttemptId(unavailable)).toBeNull()
    expect(apiErrorAttemptId(timeout)).toBe('01J8ZD')
  })

  it('is a business outcome at 400, exactly as api.get is', async () => {
    const err = await failingBlob(400, envelope(400, 'INVALID_KEY'))
    expect(err.kind).toBe('business')
    expect(apiErrorCode(err)).toBe('INVALID_KEY')
  })

  it('is a server fault on an uncoded 5xx', async () => {
    expect((await failingBlob(500, envelope(500, null))).kind).toBe('server')
  })

  // 🚩 The case the invoice screen has to branch on: the grant refusal on this
  // rail is a BARE 403 — no envelope, no errorCode — so the code is null and only
  // the status says what happened.
  it('surfaces a bare 403 with no body at all as status 403 and a null code', async () => {
    const err = await failingBlob(403, 'not json at all')
    expect(err.statusCode).toBe(403)
    expect(apiErrorCode(err)).toBeNull()
  })
})

/**
 * `api.upload` — the multipart door (ticket 273, spec 267 D8's bulk preview and
 * commit). Its subject is the one thing that cannot be asserted from a feature and
 * fails silently when it is wrong: **a `FormData` body must reach `fetch` with no
 * Content-Type header at all**, so the browser can generate
 * `multipart/form-data; boundary=…` for it.
 *
 * A hand-set `application/json` there does not merely mislabel the body — it
 * replaces the generated header, boundary and all, and the server then splits the
 * upload into no parts and reports an empty file. Everything else is `api.post`.
 */
describe('api.upload', () => {
  const ok = <T,>(data: T) =>
    vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ statusCode: 200, success: true, message: '', errors: [], data }),
    } as unknown as Response)

  const form = () => {
    const f = new FormData()
    f.append('file', new Blob(['store,amount\n0142,500'], { type: 'text/csv' }), 'august.csv')
    f.append('entryKind', 'SHORTAGE')
    return f
  }

  it('sends the FormData verbatim and lets the BROWSER set the Content-Type', async () => {
    const fetchStub = ok({ batchId: '01J9BATCH', posted: 47 })
    vi.stubGlobal('fetch', fetchStub)

    const body = form()
    const data = await api.upload<{ batchId: string; posted: number }>('Settlement/Bulk/Preview', body)

    expect(data).toEqual({ batchId: '01J9BATCH', posted: 47 })
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('Settlement/Bulk/Preview')
    expect(init.method).toBe('POST')
    // 🔑 The body is the FormData itself — not stringified, not copied.
    expect(init.body).toBe(body)
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
    // …and the rest of the door is unchanged: the CSRF header the cookie branch
    // requires, and same-origin credentials.
    expect(headers['X-Web-Client']).toBe('1')
    expect(init.credentials).toBe('same-origin')
  })

  it('still sets application/json for an ordinary JSON post', async () => {
    const fetchStub = ok({ accepted: true })
    vi.stubGlobal('fetch', fetchStub)
    await api.post('Settlement/Cancel', { settlementEntryId: '01J9', reason: 'why' })
    const [, init] = fetchStub.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('maps a refused upload through the same taxonomy as every other call', async () => {
    vi.stubGlobal('fetch', answer(409, envelope(409, 'HASH_MISMATCH', 'The sheet changed.')))
    const err = await api
      .upload('Settlement/Bulk/Commit', form())
      .catch((e: unknown) => e as ApiError)

    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).kind).toBe('business')
    expect(apiErrorCode(err)).toBe('HASH_MISMATCH')
    expect((err as ApiError).message).toBe('The sheet changed.')
  })
})

/**
 * `api.getEnvelope` — `get`, keeping the envelope (ticket 320). Its subject is
 * the two halves of that sentence: a **success** hands back the siblings that
 * rode beside `data` (which `get` drops), and a **failure** throws exactly the
 * `ApiError` `get` would have thrown at that status.
 *
 * 🔑 The sibling is named HERE, in the test, and never in `core/`: the read is
 * generic over what sits beside `data`, and a feature says what it expects.
 */
describe('api.getEnvelope', () => {
  const okBody = (body: unknown) =>
    vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => body } as unknown as Response)

  /** Collections' own answer: the row array, and a flag beside it. */
  const counted = (slipCountsUnavailable: boolean) => ({
    statusCode: 200,
    success: true,
    message: '',
    errors: null,
    serverTime: '2026-09-26T09:00:00',
    data: [{ storeId: 'P019', slipCount: slipCountsUnavailable ? null : 2 }],
    slipCountsUnavailable,
  })

  it('keeps the sibling beside data — the field `get` drops', async () => {
    vi.stubGlobal('fetch', okBody(counted(true)))
    const answer = await api.getEnvelope<{ slipCount: number | null }[], { slipCountsUnavailable: boolean }>(
      'CollectionWeb/Collections',
    )
    expect(answer.slipCountsUnavailable).toBe(true)
    expect(answer.data).toEqual([{ storeId: 'P019', slipCount: null }])

    // …and `get` over the very same body still hands back `data` alone.
    vi.stubGlobal('fetch', okBody(counted(true)))
    expect(await api.get('CollectionWeb/Collections')).toEqual([{ storeId: 'P019', slipCount: null }])
  })

  it('a false sibling survives as false, and an absent one as absent — never invented', async () => {
    vi.stubGlobal('fetch', okBody(counted(false)))
    expect((await api.getEnvelope<unknown, { slipCountsUnavailable: boolean }>('X')).slipCountsUnavailable).toBe(false)

    const { slipCountsUnavailable: _dropped, ...older } = counted(false)
    vi.stubGlobal('fetch', okBody(older))
    expect('slipCountsUnavailable' in (await api.getEnvelope<unknown, { slipCountsUnavailable: boolean }>('X'))).toBe(
      false,
    )
  })

  it('reaches the same door as get — base, query, X-Web-Client, same-origin', async () => {
    const fetchStub = okBody(counted(false))
    vi.stubGlobal('fetch', fetchStub)
    await api.getEnvelope('CollectionWeb/Ready', { Limit: 2000, CollectorId: '', ServedByKind: null })
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit]
    // The empty and null params are dropped exactly as `get` drops them.
    expect(url.endsWith('CollectionWeb/Ready?Limit=2000')).toBe(true)
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>)['X-Web-Client']).toBe('1')
    expect(init.credentials).toBe('same-origin')
  })

  const failingEnvelope = async (status: number, body: unknown): Promise<ApiError> => {
    vi.stubGlobal('fetch', answer(status, body))
    try {
      await api.getEnvelope('Anything')
    } catch (err) {
      return err as ApiError
    }
    throw new Error('expected a throw')
  }

  it('throws the usual ApiError taxonomy — the same answer get gives at each status', async () => {
    const cases: [number, unknown][] = [
      [400, envelope(400, 'ServedByKindRequired')],
      [403, 'not json at all'],
      [503, envelope(503, 'NOT_SET_UP')],
      [500, envelope(500, null)],
      [502, 'not json at all'],
      [200, { statusCode: 200, success: false, message: 'refused in band', errors: [], data: null }],
    ]
    for (const [status, body] of cases) {
      const viaEnvelope = await failingEnvelope(status, body)
      const viaGet = await failing(status, body)
      expect(viaEnvelope, `status ${status}`).toBeInstanceOf(ApiError)
      expect([viaEnvelope.kind, viaEnvelope.statusCode, apiErrorCode(viaEnvelope), viaEnvelope.message]).toEqual([
        viaGet.kind,
        viaGet.statusCode,
        apiErrorCode(viaGet),
        viaGet.message,
      ])
    }
    // Spot the arms outright, so a change to BOTH readers cannot pass by agreeing.
    expect((await failingEnvelope(503, envelope(503, 'NOT_SET_UP'))).kind).toBe('business')
    expect((await failingEnvelope(502, 'not json at all')).kind).toBe('server')
    const bare403 = await failingEnvelope(403, 'not json at all')
    expect([bare403.kind, bare403.statusCode, apiErrorCode(bare403)]).toEqual(['unknown', 403, null])
  })

  it('a fetch that throws is a network failure, as on get', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const err = await api.getEnvelope('Anything').catch((e: unknown) => e as ApiError)
    expect((err as ApiError).kind).toBe('network')
  })
})
