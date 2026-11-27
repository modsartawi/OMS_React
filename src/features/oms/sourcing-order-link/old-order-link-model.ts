/**
 * What the retired advisor's order link answers now (ticket 974, BackOffice 4397, spec 4354 §20): that order's stored
 * run, opened in the simulator, or "none" with the offer of a replay. Pure; the door is `GET SourcingAdvisor/Results/
 * OrderRun` (`./api`). The simulator opens only for a holder of the run grant: the link itself, like the results doors,
 * opens under the view grant.
 */
import type { ResultsOrderRunReply } from '@/core/models/sourcing-order-run'
import { simulatorReplayPath, simulatorRunPath } from '@/core/sourcing-advisor/simulator-path'

export type OldOrderLinkAnswer =
  /** A stored run, and the simulator may open it: go straight there. */
  | { kind: 'open'; to: string }
  /** A stored run the caller cannot open (no run grant). */
  | { kind: 'stored'; orderNumber: string; ranAt: string | null; hasSummary: boolean }
  /** No stored run: offer a replay (`replayTo` null without the run grant). */
  | { kind: 'none'; orderNumber: string; replayTo: string | null; hasSummary: boolean }
  /** The number names no order (nor a delivery of one). */
  | { kind: 'unknown'; asked: string }

/** The number the link's path carries, trimmed; null when blank (the door would refuse it `RESULTS-400`). */
export function askedNumber(raw: string | undefined): string | null {
  const n = (raw ?? '').trim()
  return n === '' ? null : n
}

export function oldOrderLinkAnswer(
  reply: ResultsOrderRunReply,
  can: { canOpenRun: boolean; canReplay: boolean },
): OldOrderLinkAnswer {
  if (reply.runId) {
    if (can.canOpenRun) return { kind: 'open', to: simulatorRunPath(reply.runId) }
    return { kind: 'stored', orderNumber: reply.orderNumber, ranAt: reply.ranAt, hasSummary: reply.hasSummary }
  }
  if (reply.orderKnown && reply.orderNumber) {
    return {
      kind: 'none',
      orderNumber: reply.orderNumber,
      replayTo: reply.offerReplay && can.canReplay ? simulatorReplayPath(reply.orderNumber) : null,
      hasSummary: reply.hasSummary,
    }
  }
  return { kind: 'unknown', asked: reply.asked }
}
