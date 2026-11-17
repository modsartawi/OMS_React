import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CopilotSteps } from '@/core/models/copilot'
import { ApiError } from '@/core/api'
import { STEP_POLL_MS, WALKED_STEP_TOOLS, liveStepKey, pollSteps, stepsOrNothing, walkedStepKey } from './steps'

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

  it('liveSteps_threeFailedReadsAndNoStepEverRead_stopPolling_theSwitchIsOff', async () => {
    // Copilot:Speed:Steps off: every read is a 404. A step is recorded before the first model call, so three seconds of
    // nothing means there will be none; the panel stops asking rather than GET a 404 every second for the whole ask.
    const d = door([null])
    const seen: string[] = []
    pollSteps(ID, d.read, (k) => seen.push(k))
    for (let i = 0; i < 6; i++) await tick()
    expect(d.reads).toHaveLength(3)
    expect(seen).toEqual([])
  })

  it('liveSteps_onceAStepWasRead_failedReadsKeepPolling', async () => {
    // A step was read, so the switch is on: a failed read later (another host behind a balancer, a blip) is no reason
    // to stop; polling goes on until done or stop, as before.
    const d = door([at(['model']), null, null, null, null, at(['model', 'answer'], true)])
    const seen: string[] = []
    pollSteps(ID, d.read, (k) => seen.push(k))
    for (let i = 0; i < 8; i++) await tick()
    expect(d.reads).toHaveLength(6)
    expect(seen).toEqual(['live.model', 'live.answer'])
  })

  it('stepsOrNothing_anyFailedReadIsNothing', async () => {
    await expect(stepsOrNothing(Promise.reject(new ApiError('server', 'down', 503)))).resolves.toBeNull()
    await expect(stepsOrNothing(Promise.resolve(at(['answer'], true)))).resolves.toEqual(at(['answer'], true))
  })
})

describe('the walked steps with no live step (D11; BackOffice 3630 walk fix)', () => {
  // The walk: a read-only map question showed "Removing from the report", because with no live step the panel walked
  // EVERY tool's words, the writing tools' too. It walks only the words of tools that read.
  const writes = /^(create_|edit_|board_|report_)/

  it("never shows a writing tool's words, over the whole walk", () => {
    const seen = Array.from({ length: 3 * WALKED_STEP_TOOLS.length }, (_, n) => walkedStepKey(n))
    expect(seen).not.toContain('steps.report_remove_blocks')
    expect(seen).not.toContain('steps.create_view')
    expect(seen.filter((key) => writes.test(key.slice('steps.'.length)))).toEqual([])
  })

  it('walks the lookups and the analytics query, and no SQL-mode step outside SQL mode', () => {
    expect(WALKED_STEP_TOOLS).toContain('semantic_query')
    expect(WALKED_STEP_TOOLS).toContain('order_timeline')
    expect(WALKED_STEP_TOOLS).not.toContain('run_sql')
    expect(WALKED_STEP_TOOLS).not.toContain('describe_tables')
    expect(walkedStepKey(0)).toBe('steps.order_timeline')
    expect(walkedStepKey(WALKED_STEP_TOOLS.length)).toBe('steps.order_timeline')
  })
})
