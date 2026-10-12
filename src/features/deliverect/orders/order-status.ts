import type { Severity } from '@/core/ui/severity'
import type { DeliverectOrderOutcome } from '@/core/models/deliverect'

// The words and tones of a Deliverect order (spec 2615 "Order processing", ticket 478). Pure: no
// React, no `t` — each function hands back a KEY in `deliverect-orders`, the page translates it.

/**
 * The status codes we send Deliverect (spec 2615's status table; contract § Orders monitor):
 * 20 Accepted, 90 Finalized, 110 Cancelled, 120 Failed, 126 Cancel failed.
 */
export const ORDER_STATUS = {
  accepted: 20,
  finalized: 90,
  cancelled: 110,
  failed: 120,
  cancelFailed: 126,
} as const

type StatusName = keyof typeof ORDER_STATUS

const STATUS_SEV: Record<StatusName, Severity> = {
  accepted: 'ok',
  finalized: 'ok',
  cancelled: 'mute',
  failed: 'bad',
  cancelFailed: 'bad',
}

const BY_CODE = new Map<number, StatusName>(Object.entries(ORDER_STATUS).map(([name, code]) => [code, name as StatusName]))

/** A status code in words: `key` names its label, or is `null` for a code the contract does not
 *  name — the page then shows the raw number, neutral. */
export interface StatusLabel {
  key: string | null
  code: number
  sev: Severity
}

export function statusLabel(code: number): StatusLabel {
  const name = BY_CODE.get(code)
  return name ? { key: `statuses.${name}`, code, sev: STATUS_SEV[name] } : { key: null, code, sev: 'mute' }
}

/**
 * A cancel that arrived after the store had invoiced (126): we told Deliverect we could not cancel,
 * so the platform and our document disagree — it needs a person (spec 2615: "126 + monitor alert").
 */
export function needsPerson(lastStatusSent: number | null | undefined): boolean {
  return lastStatusSent === ORDER_STATUS.cancelFailed
}

const OUTCOME_SEV: Record<DeliverectOrderOutcome, Severity> = {
  created: 'ok',
  refused: 'bad',
  droppedLines: 'warn',
  cancelled: 'mute',
  statusFailed: 'bad',
}

/** An outcome in words; an outcome the contract does not name is shown raw, neutral. */
export function outcomeLabel(outcome: string): { key: string | null; sev: Severity } {
  return Object.hasOwn(OUTCOME_SEV, outcome)
    ? { key: `outcomes.${outcome}`, sev: OUTCOME_SEV[outcome as DeliverectOrderOutcome] }
    : { key: null, sev: 'mute' }
}

/**
 * Retry is offered for the two failed outcomes ONLY: `refused` (re-run the order) and
 * `statusFailed` (re-send the failed status call). Anything else the door refuses with DLV-00007.
 */
export function retryOffered(outcome: string): boolean {
  return outcome === 'refused' || outcome === 'statusFailed'
}

/** The document page our document number opens. */
export function documentPath(documentNumber: string): string {
  return `/oms/document/${encodeURIComponent(documentNumber)}`
}

/**
 * The raw body for display: re-indented (2 spaces) ONLY when it parses as JSON, else exactly as
 * received. `pretty` says which — the viewer offers the verbatim text either way.
 *
 * 🚩 Never `JSON.stringify(JSON.parse(body))`: that rewrites VALUES — `1.10` becomes `1.1`, a
 * 20-digit number loses digits, `A` becomes `A` — and a disputed order is checked against
 * exactly those. Here the parse only decides WHETHER to indent; the indenting walks the text and
 * copies every string, number and literal token byte for byte, changing white space alone.
 */
export function rawView(body: string): { text: string; pretty: boolean } {
  try {
    JSON.parse(body)
  } catch {
    return { text: body, pretty: false }
  }
  return { text: reindent(body), pretty: true }
}

/** Re-indent valid JSON text: white space outside strings is dropped and laid out again. */
function reindent(json: string): string {
  let out = ''
  let depth = 0
  const newline = () => '\n' + '  '.repeat(depth)
  for (let i = 0; i < json.length; i++) {
    const c = json[i]
    if (c === '"') {
      // A string token, copied verbatim up to its closing quote (escapes included).
      let j = i + 1
      while (json[j] !== '"') j += json[j] === '\\' ? 2 : 1
      out += json.slice(i, j + 1)
      i = j
    } else if (c === '{' || c === '[') {
      // An empty object or array stays on one line.
      let j = i + 1
      while (/\s/.test(json[j])) j++
      if (json[j] === (c === '{' ? '}' : ']')) {
        out += c + json[j]
        i = j
      } else {
        depth++
        out += c + newline()
      }
    } else if (c === '}' || c === ']') {
      depth--
      out += newline() + c
    } else if (c === ',') {
      out += ',' + newline()
    } else if (c === ':') {
      out += ': '
    } else if (!/\s/.test(c)) {
      out += c
    }
  }
  return out
}
