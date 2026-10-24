/**
 * An order's prescription-session lines (BackOffice spec 2994, oms ticket 544; doors 3016 + 3014):
 * what Document Details draws, read-only, for an order or a delivery — the order's row line, one
 * line per attached session, and under each session one line per after-close event.
 *
 * In `@/core/` because the step line and the after-close line are the HQ list's too (545, 547).
 * Pure: no React, no `t`. Words are `CodeWord`s (`./words`); a sentence is a KEY in the
 * `prescription-session` namespace, with its values handed beside it for the caller to isolate.
 */
import type {
  PrescriptionSessionAfterClose,
  PrescriptionSessionOrderStatus,
  PrescriptionSessionStatus,
  PrescriptionSessionStep,
} from '@/core/models/prescription-session'
import type { Severity } from '@/core/ui/severity'
import {
  afterCloseKindWord,
  badgeWord,
  ownerWord,
  PRESCRIPTION_AFTER_CLOSE_KINDS,
  routeWord,
  sourceWord,
  stateWord,
  type CodeWord,
} from './words'

/** A next step, ready to draw: its server label, its owner as a word, what it waits on. */
export interface StepLine {
  /** SIS.Api English, shown as server text (free text: `<bdi>`). */
  label: string
  owner: CodeWord
  /** The session (`PS-…`) this one waits on; null otherwise. */
  waitingOn: string | null
  parked: boolean
  /** The park note, only while parked (a stale note on an unparked step is not shown). */
  parkNote: string | null
  badges: CodeWord[]
}

/** One after-close event: its kind, the sentence that tells it, and the values the sentence takes. */
export interface AfterCloseLine {
  kind: CodeWord
  /** `afterClose.line.<KIND>`, or `afterClose.line.other` for a kind this client does not know. */
  sentence: string
  sale: string
  document: string
  /** The re-invoice / re-sale; `''` when none. */
  resale: string
  storeCode: string
  /** Estate wall-clock, as it came (no zone conversion). */
  recordedAt: string
  recordedBy: string
}

/** One attached session, ready to draw. */
export interface SessionLine {
  sessionId: string
  displayId: string
  source: CodeWord
  holdingStore: string
  state: CodeWord
  stateSev: Severity
  route: CodeWord
  step: StepLine | null
  afterClose: AfterCloseLine[]
}

/** The panel: the order's row line, then its sessions. */
export interface OrderSessionsView {
  row: StepLine | null
  sessions: SessionLine[]
}

/**
 * A state's severity: in motion `go`; dispensed and not yet invoiced (owed) `warn`; invoiced or
 * closed `ok`; written off `bad`; abandoned, and a state this client does not know, `mute`.
 */
const STATE_SEV: Record<string, Severity> = {
  DRAFT: 'go',
  VALIDATING: 'go',
  AWAITING_APPROVAL: 'go',
  APPROVED: 'go',
  AWAITING_ORDER: 'go',
  PICKING: 'go',
  AWAITING_DELIVERY: 'go',
  DISPENSED: 'warn',
  INVOICED: 'ok',
  CLOSED: 'ok',
  ABANDONED: 'mute',
  WRITTEN_OFF: 'bad',
}

export function stateSeverity(state: string): Severity {
  return Object.prototype.hasOwnProperty.call(STATE_SEV, state) ? STATE_SEV[state] : 'mute'
}

export function stepLine(step: PrescriptionSessionStep | null | undefined): StepLine | null {
  if (!step) return null
  return {
    label: step.label ?? '',
    owner: ownerWord(step.owner),
    waitingOn: step.waitingOn || null,
    parked: step.isParked === true,
    parkNote: step.isParked === true ? step.parkNote || null : null,
    badges: (step.badges ?? []).map(badgeWord),
  }
}

export function afterCloseLine(event: PrescriptionSessionAfterClose): AfterCloseLine {
  const known = (PRESCRIPTION_AFTER_CLOSE_KINDS as readonly string[]).includes(event.kind)
  return {
    kind: afterCloseKindWord(event.kind),
    sentence: `afterClose.line.${known ? event.kind : 'other'}`,
    sale: event.originalSaleNo ?? '',
    document: event.documentNo ?? '',
    resale: event.resaleNo ?? '',
    storeCode: event.storeCode ?? '',
    recordedAt: event.recordedAt ?? '',
    recordedBy: event.recordedBy ?? '',
  }
}

export function sessionLine(s: PrescriptionSessionStatus): SessionLine {
  return {
    sessionId: s.sessionId,
    displayId: s.displayId,
    source: sourceWord(s.sourceKind),
    holdingStore: s.holdingStore ?? '',
    state: stateWord(s.state),
    stateSev: stateSeverity(s.state),
    route: routeWord(s.route),
    step: stepLine(s.step),
    afterClose: (s.afterClose ?? []).map(afterCloseLine),
  }
}

/**
 * The panel for an order's status read, or `null` — draw nothing — when no session is attached
 * (most orders), or when there is no answer. Several sessions (a shared delivery) are all listed,
 * in server order.
 */
export function orderSessionsView(status: PrescriptionSessionOrderStatus | null | undefined): OrderSessionsView | null {
  const sessions = status?.sessions ?? []
  if (sessions.length === 0) return null
  return { row: stepLine(status?.row), sessions: sessions.map(sessionLine) }
}
