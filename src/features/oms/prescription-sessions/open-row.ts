/**
 * An HQ list row as the Open grid draws it, and the three flag chips (ticket 545; BackOffice 3015).
 * Pure: no React, no `t`. Codes are `CodeWord`s from `@/core/prescription-session/words`; the step is
 * 544's `stepLine`, so it reads exactly as Document Details reads it.
 */
import type { PrescriptionSessionHqList, PrescriptionSessionHqRow } from '@/core/models/prescription-session'
import type { Severity } from '@/core/ui/severity'
import { stateSeverity, stepLine, type StepLine } from '@/core/prescription-session/lines'
import {
  openItemWord,
  otherStoreReasonWord,
  PRESCRIPTION_HQ_FLAGS,
  routeWord,
  sourceWord,
  stateWord,
  type CodeWord,
  type PrescriptionHqFlag,
} from '@/core/prescription-session/words'

export interface OpenRowView {
  state: CodeWord
  stateSev: Severity
  source: CodeWord
  route: CodeWord
  /** The second store and why it shows (a donor, an asking store), or `null`. */
  otherStore: { store: string; reason: CodeWord } | null
  step: StepLine | null
  /** The day it lapses at the end of — only while about to lapse. */
  lapseDay: string | null
  openItems: CodeWord[]
  /** The flags the row carries, in chip order. */
  flags: PrescriptionHqFlag[]
  /**
   * The row-action slot is offered (ticket 548's "Close without invoice"): a DISPENSED row only.
   * 545 draws nothing in it.
   */
  rowAction: boolean
}

/** A grid row: the session as the door sent it, and what this side derives from it. */
export type OpenGridRow = PrescriptionSessionHqRow & { view: OpenRowView }

export function openRow(r: PrescriptionSessionHqRow): OpenRowView {
  const flags: PrescriptionHqFlag[] = []
  if (r.isStalled) flags.push('STALLED')
  if (r.isAboutToLapse) flags.push('ABOUT_TO_LAPSE')
  if (r.isOwed) flags.push('OWED')
  return {
    state: stateWord(r.state),
    stateSev: stateSeverity(r.state),
    source: sourceWord(r.sourceKind),
    route: routeWord(r.route),
    otherStore: r.otherStore ? { store: r.otherStore, reason: otherStoreReasonWord(r.otherStoreReason) } : null,
    step: stepLine(r.step),
    lapseDay: r.isAboutToLapse ? r.lapsesAtEndOf || null : null,
    openItems: (r.openItems ?? []).map(openItemWord),
    flags,
    rowAction: r.state === 'DISPENSED',
  }
}

export interface FlagChip {
  flag: PrescriptionHqFlag
  /** The answer's count over every matched row (never the rows shown); `null` before an answer. */
  count: number | null
  pressed: boolean
}

const COUNT: Record<PrescriptionHqFlag, (l: PrescriptionSessionHqList) => number> = {
  STALLED: (l) => l.stalled,
  ABOUT_TO_LAPSE: (l) => l.aboutToLapse,
  OWED: (l) => l.owed,
}

/** The three chips, each with its count read from the answer. */
export function flagChips(list: PrescriptionSessionHqList | undefined, pressed: PrescriptionHqFlag | ''): FlagChip[] {
  return PRESCRIPTION_HQ_FLAGS.map((flag) => ({
    flag,
    count: list ? (COUNT[flag](list) ?? 0) : null,
    pressed: pressed === flag,
  }))
}
