/**
 * Reading a central invoice's per-delivery answers (ticket 332) — the one reading both the
 * delivery page's dialog and the bulk screen use. Pure.
 */
import type { CentralInvoiceRaiseResult } from '@/core/models/central-invoice'
import type { Severity } from '@/core/ui/severity'

/** The three verdicts BackOffice 2099 pins as stable wire spellings, plus what this client
 *  cannot read. */
export type CentralInvoiceVerdict = 'accepted' | 'wait' | 'refused' | 'unknown'

const KNOWN: readonly string[] = ['accepted', 'wait', 'refused']

/**
 * The verdict a wire spelling names. Exact match only: a casing drift or a fourth verdict
 * is `unknown` and is shown as the server sent it, never read as one of the three — an
 * unknown value labelled "Queued" would be the worst possible misreading.
 */
export function verdictOf(wire: string): CentralInvoiceVerdict {
  return KNOWN.includes(wire) ? (wire as CentralInvoiceVerdict) : 'unknown'
}

/** One colour per verdict: queued is a good outcome, *wait* asks for a later retry,
 *  refused needs a person. */
export const VERDICT_SEVERITY: Record<CentralInvoiceVerdict, Severity> = {
  accepted: 'ok',
  wait: 'warn',
  refused: 'bad',
  unknown: 'mute',
}

/**
 * The delivery numbers to try again later: every row not confirmed as queued — refused,
 * *wait*, and any verdict this client cannot read — in the order the server answered.
 */
export function retryList(results: readonly CentralInvoiceRaiseResult[]): string[] {
  return results.filter((r) => verdictOf(r.verdict) !== 'accepted').map((r) => r.deliveryNo)
}

/** How many rows got each verdict. */
export function verdictTally(results: readonly CentralInvoiceRaiseResult[]): Record<CentralInvoiceVerdict, number> {
  const tally: Record<CentralInvoiceVerdict, number> = { accepted: 0, wait: 0, refused: 0, unknown: 0 }
  for (const r of results) tally[verdictOf(r.verdict)]++
  return tally
}
