import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CopilotSteps } from '@/core/models/copilot'
import { ApiError } from '@/core/api'
import { STEP_POLL_MS, liveStepKey, pollSteps, stepsOrNothing } from './steps'

const ID = '01JCOPILOT0000000000000000'

const at = (steps: string[], done = false): CopilotSteps => ({
  requestId: ID,
  done,
  steps: steps.map((step, i) => ({ step, label: `server label ${i}`, at: `2026-11-11T10:00:0${i}` })),
})

/** A `Copilot/Ask/{id}/Steps` stand-in answering each poll from a script; past its end it repeats the last answer. */
function door(script: (CopilotSteps | null)[]) {
  const reads: string[] = []
  const read = (id: string) => {
    reads.push(id)
    return Promise.resolve(script[Math.min(reads.length, script.length) - 1])
  }
  return { read, reads }
}

/** One poll period passes and its read settles. */
const tick = () => vi.advanceTimersByTimeAsync(STEP_POLL_MS)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('the live steps (spec 3558 D12, D17; ticket 869)', () => {
  it('liveSteps_replaceEachOtherAsTheyArrive', async () => {
    const d = door([at(['model']), at(['model', 'tool:semantic_query']), at(['model', 'tool:semantic_query', 'answer'])])
    const seen: (string | null)[] = []
    const stop = pollSteps(ID, d.read, (k) => seen.push(k))
    await tick()
    expect(seen).toEqual(['live.model'])
    await tick()
    expect(seen).toEqual(['live.model', 'steps.semantic_query'])
    await tick()
    // The latest step only, in the panel's words (not the server's English label).
    expect(seen).toEqual(['live.model', 'steps.semantic_query', 'live.answer'])
    expect(d.reads).toEqual([ID, ID, ID])
    stop()
  })

  it('liveStepKey_namesEachStepInTheLocaleFiles_unknownToolIsGeneric', () => {
    expect(liveStepKey('model')).toBe('live.model')
    expect(liveStepKey('answer')).toBe('live.answer')
    expect(liveStepKey('tool:describe_model')).toBe('steps.describe_model')
    expect(liveStepKey('tool:create_view')).toBe('steps.create_view')
    expect(liveStepKey('tool:a_tool_this_build_does_not_know')).toBe('live.tool')
    expect(liveStepKey('something_new')).toBe('live.tool')
  })

  it('liveSteps_stopWhenTheServerSaysDone', async () => {
    const d = door([at(['model']), at(['model', 'answer'], true)])
    const seen: string[] = []
    pollSteps(ID, d.read, (k) => seen.push(k))
    await tick()
    await tick()
    await tick()
    await tick()
    expect(d.reads).toHaveLength(2)
    expect(seen).toEqual(['live.model', 'live.answer'])
  })

  it('liveSteps_stopWhenTheAnswerLandsOrThePanelCloses', async () => {
    // The panel calls stop when its question is no longer in flight (answer, refusal, Stop) and when it unmounts.
    const d = door([at(['model'])])
    const seen: string[] = []
    const stop = pollSteps(ID, d.read, (k) => seen.push(k))
    await tick()
    expect(d.reads).toHaveLength(1)
    stop()
    await tick()
    await tick()
    expect(d.reads).toHaveLength(1)
    expect(seen).toEqual(['live.model'])
  })

  it('liveSteps_aReadInFlightWhenStoppedShowsNothing', async () => {
    let settle: (s: CopilotSteps) => void = () => {}
    const read = () => new Promise<CopilotSteps | null>((r) => (settle = r))
    const seen: string[] = []
    const stop = pollSteps(ID, read, (k) => seen.push(k))
    await tick()
    stop()
    settle(at(['model']))
    await tick()
    expect(seen).toEqual([])
  })

  it('liveSteps_a404ShowsNoStep_soTodaysWorkingStateStays_andPollingGoesOn', async () => {
    const notFound = new ApiError('unknown', 'Unexpected response (404)', 404)
    let reads = 0
    const read = () => {
      reads++
      return stepsOrNothing(reads < 3 ? Promise.reject(notFound) : Promise.resolve(at(['model'])))
    }
    const seen: string[] = []
    const stop = pollSteps(ID, read, (k) => seen.push(k))
    await tick()
    await tick()
    expect(seen).toEqual([])
    // Nothing yet is not the end: the first step may simply not be recorded yet.
    await tick()
    expect(seen).toEqual(['live.model'])
    stop()
  })

  it('stepsOrNothing_anyFailedReadIsNothing', async () => {
    await expect(stepsOrNothing(Promise.reject(new ApiError('server', 'down', 503)))).resolves.toBeNull()
    await expect(stepsOrNothing(Promise.resolve(at(['answer'], true)))).resolves.toEqual(at(['answer'], true))
  })
})
