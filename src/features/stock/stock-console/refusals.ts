/**
 * The console's refusals (oms 941, BackOffice spec 4157 story 83) — pure: which sentence a failed read says. One table
 * for every page of the console, so a code the server renames is a one-line change here (wire.md "Refusal codes").
 *
 * A refusal is an answer, not a crash: busy, timed out, a name too wide, a batch prefix too short each say what to do.
 * Stock Visibility not reached — named by SIS.Api, or an outage with no code at all — is one sentence that says it is
 * not the reader's search. A code this table does not know says the generic sentence with the server's own beside it.
 */
import { apiErrorCode, apiErrorKind, apiErrorMessage, isBareDenial } from '@/core/api'

/** The codes the console names, each with its own sentence key (`refusal.<key>`). */
const OWN_SENTENCE = {
  ConsoleBusy: 'ConsoleBusy',
  ConsoleTimeout: 'ConsoleTimeout',
  NarrowTheName: 'NarrowTheName',
  BatchTooShort: 'BatchTooShort',
  PrefixNeedsItem: 'PrefixNeedsItem',
  NothingToFind: 'NothingToFind',
  WindowTooLong: 'WindowTooLong',
  SapNotConfigured: 'SapNotConfigured',
  SapUnreachable: 'SapUnreachable',
  NoStore: 'NoStore',
  NoRow: 'NoRow',
  // [guess] SIS.Api's names for Stock Visibility not reachable / over its time limit — one sentence for both.
  StockVisibilityUnreachable: 'unreachable',
  StockVisibilityTimeout: 'unreachable',
} as const satisfies Record<string, string>

export const REFUSAL_CODES = Object.keys(OWN_SENTENCE) as readonly (keyof typeof OWN_SENTENCE)[]

/** The codes whose server sentence is the reason worth showing beside ours (SAP's own error text). */
const WITH_REASON: ReadonlySet<string> = new Set(['SapUnreachable'])

/** Every sentence key `refusalOf` can answer, for the locale test. */
export const REFUSAL_KEYS = [...new Set([...Object.values(OWN_SENTENCE), 'unreachable', 'denied', 'failed'])].map(
  (k) => `refusal.${k}`,
)

export interface Refusal {
  /** The server's code, when it sent one. */
  code: string | null
  /** The sentence's locale key in the `stock-console` namespace. */
  key: string
  /** The server's own sentence, drawn beside ours, when it adds something (an unknown code, SAP's reason). */
  reason: string | null
}

const isOwn = (code: string): code is keyof typeof OWN_SENTENCE => Object.hasOwn(OWN_SENTENCE, code)

export function refusalOf(err: unknown): Refusal {
  const code = apiErrorCode(err)
  if (code !== null) {
    if (isOwn(code))
      return { code, key: `refusal.${OWN_SENTENCE[code]}`, reason: WITH_REASON.has(code) ? apiErrorMessage(err, '') || null : null }
    return { code, key: 'refusal.failed', reason: apiErrorMessage(err, '') || null }
  }
  if (isBareDenial(err)) return { code: null, key: 'refusal.denied', reason: null }
  const kind = apiErrorKind(err)
  if (kind === 'network' || kind === 'server') return { code: null, key: 'refusal.unreachable', reason: null }
  return { code: null, key: 'refusal.failed', reason: null }
}
