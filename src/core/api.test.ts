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
import { ApiError, api, apiErrorCode } from './api'

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
