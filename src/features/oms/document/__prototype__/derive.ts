/* PROTOTYPE 371 — throwaway. The two pure derivations every variant draws.
 *
 * timeline(): 369's rulings, literally —
 *   steps = Created → Ready → Out for delivery → Delivered (pick-in-store skips Out);
 *   reached from the CURRENT status columns; a close replaces the next step
 *   (R = requested, amber, final; C/N/X = cancelled, red) and drops later steps;
 *   a rewind (DRBK / DRSC / DCHC as lastAction) puts a marker on the current step;
 *   times = latest Log row whose actionType reached the step, else no time;
 *   the next unreached step may show the slot window as an EXPECTATION.
 * feed(): Log + Jobs merged on entryTime, one list.
 */
import type {
  SdDocumentHeaderModel,
  SdDocumentLogModel,
  SdDocumentOutboxModel,
} from '@/core/models/sd-document'
import { deliveryWindow } from '../fields'

export type StepState = 'done' | 'current' | 'next' | 'later' | 'requested' | 'cancelled'
export interface Step {
  key: string
  label: string
  state: StepState
  /** A real time from the Log, or null — never a guess. */
  time: string | null
  /** The slot window, as an expectation (only on the next unreached step). */
  expect: string | null
  marker: { label: string; time: string | null } | null
}

const LOG_CODES: Record<string, string[]> = {
  created: ['DCRT'],
  ready: ['DRDY', 'DTXC'],
  out: ['DOFD'],
  delivered: ['DDLR'],
  requested: ['DRCL'],
  cancelled: ['DCLS', 'DFCL', 'DCNI', 'DCAD'],
}
const REWINDS: Record<string, string> = {
  DRBK: 'Returned by driver · needs reschedule',
  DRSC: 'Rescheduled',
  DCHC: 'Courier changed',
}

const up = (v: unknown) => String(v ?? '').trim().toUpperCase()

function latest(logs: SdDocumentLogModel[] | null, codes: string[]): string | null {
  const hit = (logs ?? []).filter((l) => codes.includes(up(l.actionType)))
  return hit.length ? hit[hit.length - 1].entryTime : null
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso || iso.startsWith('0001')) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
export function fmtDayTime(iso: string | null | undefined): string {
  if (!iso || iso.startsWith('0001')) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${fmtTime(iso)}`
}

export function timeline(doc: SdDocumentHeaderModel, logs: SdDocumentLogModel[] | null): Step[] {
  const s = doc.status ?? ({} as SdDocumentHeaderModel['status'])
  const pis = up(doc.deliveryType) === 'P'
  const keys = pis ? ['created', 'ready', 'delivered'] : ['created', 'ready', 'out', 'delivered']
  const LABEL: Record<string, string> = {
    created: 'Created',
    ready: 'Ready',
    out: 'Out for delivery',
    delivered: pis ? 'Delivered (collected)' : 'Delivered',
    requested: 'Cancellation requested',
    cancelled: 'Cancelled',
  }
  const reached: Record<string, boolean> = {
    created: true,
    ready: ['R', 'C'].includes(up(s.readyStatus)),
    out: up(s.deliveryStatus) === 'O',
    delivered: up(s.deliveryStatus) === 'D',
  }
  // Furthest reached; everything before it counts as done.
  let furthest = 0
  keys.forEach((k, i) => {
    if (reached[k]) furthest = i
  })
  const close = up(s.closeStatus)
  const closeKind = close === 'R' ? 'requested' : ['C', 'N', 'X'].includes(close) ? 'cancelled' : null
  const completed = keys[furthest] === 'delivered' && !closeKind

  const steps: Step[] = []
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (closeKind && i > furthest) break
    // Cancelled after delivery: the cancellation replaces Delivered itself.
    if (closeKind && k === 'delivered' && i === furthest) break
    const isCur = i === furthest && !completed && !closeKind
    steps.push({
      key: k,
      label: LABEL[k],
      state: i <= furthest ? (isCur ? 'current' : 'done') : i === furthest + 1 ? 'next' : 'later',
      time: i <= furthest ? latest(logs, LOG_CODES[k]) : null,
      // 083 D-7's deliveryWindow(), never the raw schedule fields: live captures carry
      // from === to junk (8000000121: 23:56–23:56) while the slot says 8pm - 10 pm.
      expect: i === furthest + 1 && !closeKind ? deliveryWindow(doc) || null : null,
      marker: null,
    })
  }
  if (closeKind) {
    steps.push({
      key: closeKind,
      label: LABEL[closeKind],
      state: closeKind,
      time: latest(logs, LOG_CODES[closeKind]),
      expect: null,
      marker: null,
    })
  }
  const rewind = REWINDS[up(s.lastAction)]
  if (rewind && !closeKind) {
    const cur = steps.find((x) => x.state === 'current') ?? steps[steps.length - 1]
    cur.marker = { label: rewind, time: latest(logs, [up(s.lastAction)]) }
  }
  return steps
}

/** The step the header names as "where it is now". */
export function nowStep(steps: Step[]): Step {
  return (
    steps.find((s) => s.state === 'requested' || s.state === 'cancelled') ??
    steps.find((s) => s.state === 'current') ??
    steps[steps.length - 1]
  )
}

// ---- feed ------------------------------------------------------------------------

export type FeedKind = 'log' | 'note' | 'job-ok' | 'job-failed' | 'job-retrying' | 'job-queued'
export interface FeedItem {
  id: string
  at: string
  kind: FeedKind
  title: string
  by: string
  detail: string
  code: string
}

export function jobKind(j: SdDocumentOutboxModel): FeedKind {
  const st = up(j.outboxStatus)
  if (st === 'F') return 'job-failed'
  if (st === 'C') return 'job-ok'
  return j.errorMessage ? 'job-retrying' : 'job-queued'
}

export function feed(
  logs: SdDocumentLogModel[] | null,
  jobs: SdDocumentOutboxModel[] | null,
  newestFirst: boolean,
): FeedItem[] {
  const items: FeedItem[] = [
    ...(logs ?? []).map((l) => ({
      id: 'l' + l.logNo,
      at: l.entryTime,
      kind: (up(l.actionType) === 'DADN' ? 'note' : 'log') as FeedKind,
      title: l.actionTypeDescription || l.actionType,
      by: l.entryUser,
      detail: [l.note, l.actionData].filter(Boolean).join(' · '),
      code: l.actionType,
    })),
    ...(jobs ?? []).map((j) => {
      const kind = jobKind(j)
      const detail =
        kind === 'job-failed'
          ? `Failed after ${j.attemptCount} attempts — ${j.errorMessage}`
          : kind === 'job-retrying'
            ? `Failing, retrying automatically · attempt ${j.attemptCount} · next ${fmtTime(j.nextAttemptTime)} — ${j.errorMessage}`
            : kind === 'job-queued'
              ? 'Queued'
              : `Completed · ${j.attemptCount} attempt${j.attemptCount === 1 ? '' : 's'}`
      return { id: 'j' + j.outboxId, at: j.entryTime, kind, title: j.actionTypeDescription, by: 'job', detail, code: j.actionType }
    }),
  ]
  items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  return newestFirst ? items.reverse() : items
}

export const failedJobs = (jobs: SdDocumentOutboxModel[] | null) => (jobs ?? []).filter((j) => up(j.outboxStatus) === 'F')
export const retryingJobs = (jobs: SdDocumentOutboxModel[] | null) =>
  (jobs ?? []).filter((j) => jobKind(j) === 'job-retrying')

/** 369's due/paid tag: `Due 72.50` while amountDue > 0, else `Paid`. */
export function dueTag(doc: SdDocumentHeaderModel): { paid: boolean; text: string } {
  const due = Number(doc.amountDue ?? 0)
  return due > 0 ? { paid: false, text: `Due ${due.toFixed(2)}` } : { paid: true, text: 'Paid' }
}
