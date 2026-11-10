import type { CopilotSteps } from '@/core/models/copilot'
import { COPILOT_TOOLS, toolStepKey, type CopilotTool } from './trace'

/**
 * The live steps (ticket 869, BackOffice spec 3558 D12, D17; server half 3565). While a question is out the panel
 * polls `GET Copilot/Ask/{requestId}/Steps` about every second and shows the LATEST step's words in its working state.
 * Not a stream: the answer call stays one request (D10 of 734).
 *
 * A read that finds nothing (404: nothing recorded yet, or `Copilot:Speed:Steps` off) shows no step, so the panel keeps
 * today's single working state. Polling goes on, because the first step may simply not be recorded yet — but only for
 * {@link STEP_POLL_GRACE} reads: the server records a step before its first model call, so that many failed reads in a
 * row with no step ever read means the switch is off, and polling stops rather than GET a 404 every second for the
 * whole ask. Once a step has been read, a failed read is a blip and polling goes on as before.
 */

/** About every second (D17). */
export const STEP_POLL_MS = 1000

/** Failed reads in a row, with no step ever read for the question, after which polling stops (the switch is off). */
export const STEP_POLL_GRACE = 3

const isKnownTool = (tool: string): tool is CopilotTool => (COPILOT_TOOLS as readonly string[]).includes(tool)

/**
 * The step's words, as a key in the `copilot` namespace (en + ar), never the server's English `label`. A known tool
 * reuses the working state's `steps.<tool>` words; a tool this build does not know is "Looking up the data".
 */
export function liveStepKey(step: string): string {
  if (step === 'model') return 'live.model'
  if (step === 'answer') return 'live.answer'
  const tool = step.startsWith('tool:') ? step.slice('tool:'.length) : ''
  return isKnownTool(tool) ? toolStepKey(tool) : 'live.tool'
}

/**
 * A steps read that failed is nothing: a 404 (nothing recorded yet, the switch off, another host behind a balancer),
 * or anything else. The working state then stays as it is today; the answer itself is never held up by a poll.
 */
export function stepsOrNothing(read: Promise<CopilotSteps | null>): Promise<CopilotSteps | null> {
  return read.then(
    (found) => found ?? null,
    () => null,
  )
}

/**
 * Polls one question's steps until it is `done` or the returned stop is called (the answer landed, Stop, or the panel
 * closed), or until {@link STEP_POLL_GRACE} reads in a row found nothing and none ever found a step. One read at a time:
 * the next is scheduled only after the last settles. `onStep` receives the latest step's key whenever a read finds one.
 */
export function pollSteps(
  requestId: string,
  read: (requestId: string) => Promise<CopilotSteps | null>,
  onStep: (key: string) => void,
  every: number = STEP_POLL_MS,
): () => void {
  let stopped = false
  let everRead = false
  let misses = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const next = () => {
    timer = setTimeout(poll, every)
  }
  const poll = () => {
    timer = null
    stepsOrNothing(read(requestId)).then((found) => {
      if (stopped) return
      const last = found?.steps?.[found.steps.length - 1]
      if (last && typeof last.step === 'string') {
        everRead = true
        onStep(liveStepKey(last.step))
      }
      if (found?.done) return
      misses = found === null ? misses + 1 : 0
      if (!everRead && misses >= STEP_POLL_GRACE) return
      next()
    })
  }
  next()
  return () => {
    stopped = true
    if (timer !== null) clearTimeout(timer)
  }
}
