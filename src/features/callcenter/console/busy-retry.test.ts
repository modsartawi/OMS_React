/**
 * `busyRetriesOnScheduleThenSurrenders` — ticket 164's first pure proof.
 *
 * `SESSION_BUSY` is routine (law 7): the 15 s strict claim is the engine's only
 * mutual exclusion, so two requests on one order collide as a matter of course.
 * The wrapper is asserted at its edge — a fake verb in, the delays it waited and
 * the error it finally raised out. The sleep is injected, so the schedule is
 * proven in microseconds rather than in the six real seconds it describes.
 *
 * Nothing here knows that the verb is an HTTP call or that a strip renders while
 * it runs (spec 160's testing ruling).
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { BUSY_BACKOFF_MS, withBusyRetry } from './api'

/** A refusal exactly as `core/api.ts` maps it: 409 carrying the envelope, so
 *  `kind:'business'` and `apiErrorCode()` can read the code (§7). */
const refusal = (code: string, data: unknown = null) =>
  new ApiError(
    'business',
    'refused',
    409,
    [{ errorCode: code, internalErrorCode: '', errorMessage: '' }],
    data,
  )

/** A verb that answers `SESSION_BUSY` `busyTimes` times and then succeeds. */
function collidingVerb(busyTimes: number) {
  let attempts = 0
  return {
    get attempts() {
      return attempts
    },
    call: async () => {
      attempts += 1
      if (attempts <= busyTimes) throw refusal('SESSION_BUSY', { retryAfterMs: 400 })
      return `ok after ${attempts}`
    },
  }
}

/** Records what was waited instead of waiting it. */
function fakeSleep() {
  const waited: number[] = []
  return { waited, sleep: async (ms: number) => void waited.push(ms) }
}

describe('withBusyRetry', () => {
  it('rides out a collision on the contract schedule and returns the answer', async () => {
    const verb = collidingVerb(2)
    const { waited, sleep } = fakeSleep()

    await expect(withBusyRetry(verb.call, { sleep })).resolves.toBe('ok after 3')
    // A success mid-schedule stops it: two collisions cost two waits, not five.
    expect(waited).toEqual([0, 400])
    expect(verb.attempts).toBe(3)
  })

  it('waits 0 · 400 · 800 · 1600 · 3200 and then surrenders', async () => {
    const verb = collidingVerb(Infinity)
    const { waited, sleep } = fakeSleep()

    // The ceiling is a REFUSAL, not a silent giving-up: the caller still gets
    // the server's own last word, which is what the still-busy state shows.
    await expect(withBusyRetry(verb.call, { sleep })).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 409,
    })
    expect(waited).toEqual([0, 400, 800, 1600, 3200])
    expect(waited).toEqual([...BUSY_BACKOFF_MS])
    // Bounded, and bounded by the schedule alone — six attempts, ~6 s of waiting
    // inside the worst-case 15 s self-lockout.
    expect(verb.attempts).toBe(BUSY_BACKOFF_MS.length + 1)
    expect(waited.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(15_000)
  })

  it('reports each retry as it happens, so the strip can say it is retrying', async () => {
    const seen: Array<[number, number]> = []
    const { sleep } = fakeSleep()
    await withBusyRetry(collidingVerb(3).call, {
      sleep,
      onRetry: (retry, delayMs) => seen.push([retry, delayMs]),
    })
    expect(seen).toEqual([
      [1, 0],
      [2, 400],
      [3, 800],
    ])
  })

  it('never waits at all when the first attempt succeeds', async () => {
    const { waited, sleep } = fakeSleep()
    await expect(withBusyRetry(async () => 'fine', { sleep })).resolves.toBe('fine')
    expect(waited).toEqual([])
  })

  it('rethrows any other ApiError untouched rather than retrying it', async () => {
    // 🚩 The property that keeps this wrapper honest. A guardrail refusal
    // (§7) is the server's considered answer; retrying it five times would
    // turn one refusal into six and delay the banner the agent needs to read.
    for (const code of ['REBIND_REFUSED', 'SESSION_CLOSED', 'NOT_YOUR_SESSION', 'ITEM_NOT_FOUND']) {
      const { waited, sleep } = fakeSleep()
      let attempts = 0
      const thrown = refusal(code)
      await expect(
        withBusyRetry(
          async () => {
            attempts += 1
            throw thrown
          },
          { sleep },
        ),
      ).rejects.toBe(thrown)
      expect(attempts).toBe(1)
      expect(waited).toEqual([])
    }
  })

  it('rethrows a failure that is not an ApiError at all', async () => {
    const { waited, sleep } = fakeSleep()
    const boom = new TypeError('undefined is not a function')
    await expect(withBusyRetry(async () => Promise.reject(boom), { sleep })).rejects.toBe(boom)
    expect(waited).toEqual([])
  })

  it('leaves the schedule frozen — the contract fixes it, not the server hint', () => {
    // §6.1. `retryAfterMs` rides the refusal's envelope and is deliberately NOT
    // honoured as a delay: a bounded client-side ceiling is what guarantees the
    // agent reaches the still-busy state, and a server hint could postpone it.
    expect(BUSY_BACKOFF_MS).toEqual([0, 400, 800, 1600, 3200])
  })
})
