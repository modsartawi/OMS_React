/**
 * Oms 923 — the reveal door at the `@/core/api` boundary (BackOffice 4053 `POST …/Cases/{caseId}/Reveal`, GUESSED: not
 * built). What is sent, and what of the answer reaches the caller: the patient key and the member id, read field by
 * field, so nothing else a server sends (a policy, a name) is ever held, even in the reveal dialog's own state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { ApiError } = await import('@/core/api')
const { patternsApi } = await import('./api')
const { RevealEmptyError, RevealNotSentError } = await import('./reveal')

/** Synthetic, from the reserved test ranges: never a real patient. */
const PATIENT = { patientKey: 'NI:1000000019', memberId: 'TST-M-4471' }

beforeEach(() => {
  api.post.mockReset().mockResolvedValue({ ...PATIENT })
})

describe('the reveal door', () => {
  it('posts the trimmed reason to …/Cases/{caseId}/Reveal, the id escaped, and no actor', async () => {
    await patternsApi.reveal('01JD/3K', '  The payer asked for this case by letter.  ')
    expect(api.post).toHaveBeenCalledWith('Insurance/Patterns/Cases/01JD%2F3K/Reveal', { reason: 'The payer asked for this case by letter.' })
  })

  it('answers the patient key and the member id, and nothing else the server sent', async () => {
    api.post.mockResolvedValue({ ...PATIENT, policyNumber: 'TST-POL-1', name: 'Test Patient', revealId: 501 })
    expect(await patternsApi.reveal('01JD3K', 'The payer asked for this case.')).toEqual({ patientKey: 'NI:1000000019', memberId: 'TST-M-4471' })
  })

  it('a patient with no member id answers it empty', async () => {
    api.post.mockResolvedValue({ patientKey: 'BN:4000000017' })
    expect(await patternsApi.reveal('01JD3K', 'The payer asked for this case.')).toEqual({ patientKey: 'BN:4000000017', memberId: '' })
  })

  it('an answer without a patient key is not a reveal: it throws, and shows nobody', async () => {
    for (const answer of [null, {}, { patientKey: '', memberId: 'TST-M-4471' }, { patientKey: '   ' }]) {
      api.post.mockResolvedValue(answer)
      await expect(patternsApi.reveal('01JD3K', 'The payer asked for this case.')).rejects.toBeInstanceOf(RevealEmptyError)
    }
  })

  it('a reason too short or too long is never sent', async () => {
    for (const reason of ['too short', '  123456789  ', 'x'.repeat(251)])
      await expect(patternsApi.reveal('01JD3K', reason)).rejects.toBeInstanceOf(RevealNotSentError)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('a refusal reaches the caller as the door’s own error, with nobody in it', async () => {
    const refusal = new ApiError('business', 'The reveal could not be logged, so no patient is shown.', 500, [
      { errorCode: 'REVEAL_NOT_LOGGED', internalErrorCode: '', errorMessage: 'The reveal could not be logged, so no patient is shown.' },
    ])
    api.post.mockRejectedValue(refusal)
    await expect(patternsApi.reveal('01JD3K', 'The payer asked for this case.')).rejects.toBe(refusal)
  })
})
