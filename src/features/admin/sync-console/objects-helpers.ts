import type { Severity } from '@/core/ui/severity'
import type { EnrolObjectResponse, PushObject } from '@/core/models/sync-console'
import { figure } from './helpers'

/**
 * The Objects page's pure rules (ticket 662, BackOffice 2557-2560). The list is advice only:
 * the enrol door re-checks every condition under its lock, so nothing here is a guard.
 */

/**
 * A row's state, as the door contract offers Enrol: on a row that is not `enrolled` and has
 * a `lineNumber`. An object with no line number cannot be enrolled from the console; its
 * number is a code change (spec 2557).
 */
export type ObjectState = 'enrolled' | 'ready' | 'noLine'

export const OBJECT_STATES: readonly ObjectState[] = ['enrolled', 'ready', 'noLine']

export function objectState(o: PushObject): ObjectState {
  if (o.enrolled) return 'enrolled'
  return o.lineNumber === null ? 'noLine' : 'ready'
}

const STATE_SEVERITY: Record<ObjectState, Severity> = {
  enrolled: 'ok',
  ready: 'warn',
  noLine: 'mute',
}

export function objectStateBadge(state: ObjectState): { labelKey: string; sev: Severity } {
  return { labelKey: `objects.states.${state}`, sev: STATE_SEVERITY[state] }
}

/**
 * The rows the page draws. It opens on the objects still to enrol (spec 2557: the console offers
 * the objects no store is enrolled for); `showEnrolled` adds the rest. The door's order (the
 * distributor's) is kept either way, so a wave's lines read in the order they enrol.
 */
export function visibleObjects(items: readonly PushObject[], showEnrolled: boolean): PushObject[] {
  return showEnrolled ? [...items] : items.filter((o) => !o.enrolled)
}

/** The counts above the list: every pushed object, those enrolled, those waiting. */
export function objectCounts(items: readonly PushObject[]): { total: number; enrolled: number; waiting: number } {
  const enrolled = items.filter((o) => o.enrolled).length
  return { total: items.length, enrolled, waiting: items.length - enrolled }
}

/**
 * The preview's sentence key and values. An empty table enrols only the counter rows, so it says
 * that rather than "sends 0 rows". The numbers come formatted; the caller isolates them.
 */
export function enrolPreviewSentence(r: EnrolObjectResponse): {
  key: 'enrol.preview.rows' | 'enrol.preview.empty'
  values: { count: number; rows: string; stores: string; line: string; from: string; to: string }
} {
  return {
    key: r.actionsMinted === 0 ? 'enrol.preview.empty' : 'enrol.preview.rows',
    values: {
      count: r.actionsMinted,
      rows: figure(r.actionsMinted),
      stores: figure(r.storesEnrolled),
      line: String(r.lineNumber),
      from: String(r.blockStart),
      to: String(r.blockEnd),
    },
  }
}

/**
 * The enrol door's refusals the bundle words (`enrol.codes.*`), in the order the door checks them
 * after the request's own shape. `BAD_REQUEST` and `REASON_REQUIRED` are not here: the dialog never
 * sends a request without an object and a reason.
 */
export const ENROL_REFUSALS = [
  'PULL_OBJECT',
  'UNKNOWN_OBJECT',
  'ALREADY_ENROLLED',
  'NO_STORES',
  'TOO_MANY_ROWS',
  'BAD_KEY',
  'ENROL_BUSY',
] as const

/** A refusal code's words as a `sync-console` key, or `null` for one the bundle does not know (the code shows alone). */
export function enrolRefusalKey(code: string): string | null {
  return (ENROL_REFUSALS as readonly string[]).includes(code) ? `enrol.codes.${code}` : null
}
