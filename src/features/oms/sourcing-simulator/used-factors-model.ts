/**
 * What the run used (ticket 965, BackOffice spec 4354 §12, story 35; BackOffice 4379, `used[]` as `RecordUsed`) and the
 * marks of the run. Every factor as sent — per mode where it is read per mode — with how it ran, its source and how many
 * stores ran on the default, and four counts on top — real data, a neutral default, an assumption, switched off (SIMT
 * decision 11). A state the screen does not know is listed and counted under none of the four.
 * SERVER GAP (spec 4354) — `RecordUsed` carries no "how it enters" (filter, offered stock, promise, cost): the column
 * shows the factor's mode instead.
 *
 * The marks are read off the reply: a straight-line distance (a shipment's `kmKind`, a travel part, or the solve mark
 * `ROAD_NOT_MEASURED`), assumed rates (`ASSUMED_RATES`, 4363), a shipment with no location (no km, or its mark
 * `NO_LOCATION`), the list fee (spec §6: a waived fee is not modelled, so every fee shown is the fee rule's), the Dawaa
 * Now range not confirmed (a plan's mark `RANGE_NOT_CONFIRMED`, BackOffice 4362), and the time the figures were read on
 * a run planned again (`figuresReadAt`). Any other solve mark follows by its code.
 */
import { USED_STATES, type AdviseReply, type UsedState } from '@/core/models/sourcing-run'

export interface UsedRow {
  factor: string
  /** The mode, for a factor read per mode. */
  mode: string | null
  state: string
  source: string | null
  /** On real data for some stores, its neutral default for others: how many stores ran on the default. */
  storesOnDefault: number | null
}

export interface UsedFactors {
  counts: Record<UsedState, number>
  rows: UsedRow[]
}

export function usedFactors(reply: AdviseReply): UsedFactors {
  const rows = (reply.used ?? []).map((u) => ({ factor: u.factor, mode: u.mode ?? null, state: u.state, source: u.source ?? null, storesOnDefault: u.storesOnDefault ?? null }))
  const counts = Object.fromEntries(USED_STATES.map((s) => [s, rows.filter((r) => r.state === s).length])) as Record<UsedState, number>
  return { counts, rows }
}

export type RunMark =
  | { key: 'straightLine' | 'assumption' | 'noLocation' | 'listFee' | 'rangeNotConfirmed' }
  | { key: 'figuresReadAt'; at: string }
  | { key: 'solve'; code: string }

/** The marks a named run mark stands for, so each is said once (`RunMarks`, `ShipmentMarks`, `PlanMarks`). */
const FOLDED = new Set(['ROAD_NOT_MEASURED', 'ASSUMED_RATES', 'NO_LOCATION', 'RANGE_NOT_CONFIRMED'])

export function runMarks(reply: AdviseReply): RunMark[] {
  const marks = reply.solve.marks ?? []
  const ships = reply.plans.flatMap((p) => p.shipments)
  const out: RunMark[] = []
  if (marks.includes('ROAD_NOT_MEASURED') || ships.some((s) => s.kmKind === 'STRAIGHT_LINE' || s.promiseParts?.travel?.source === 'STRAIGHT_LINE')) out.push({ key: 'straightLine' })
  if (marks.includes('ASSUMED_RATES')) out.push({ key: 'assumption' })
  if (marks.includes('NO_LOCATION') || ships.some((s) => s.km === undefined || (s.marks ?? []).includes('NO_LOCATION'))) out.push({ key: 'noLocation' })
  if (ships.some((s) => s.fee > 0)) out.push({ key: 'listFee' })
  if (marks.includes('RANGE_NOT_CONFIRMED') || reply.plans.some((p) => (p.marks ?? []).includes('RANGE_NOT_CONFIRMED'))) out.push({ key: 'rangeNotConfirmed' })
  if (reply.figuresReadAt) out.push({ key: 'figuresReadAt', at: reply.figuresReadAt })
  for (const code of marks) if (!FOLDED.has(code)) out.push({ key: 'solve', code })
  return out
}
