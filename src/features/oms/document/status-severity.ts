/**
 * The per-status severity table for the document pill rail, and the echo test
 * that decides when a status renders as a raw code (spec 083 D-3/D-4, ticket 079).
 *
 * **Read this before deleting the file.** The map never supplies a word. The
 * pill's label always comes from the server's `*Description` companion; this map
 * supplies only a **colour**. A missing entry costs a colour and nothing else —
 * the pill still renders and still reads correctly, just in grey. The 406 maps
 * were deleted because a missing entry rendered a **raw code to the operator**,
 * and because the server already resolved what they were resolving. Severity is
 * not on the payload and no server field carries it; it cannot be resolved
 * server-side. Different failure mode, different justification.
 *
 * Feature-local on purpose (not `core/constants/oms-codes.ts`): one screen
 * consumes it, and shared code moves up when a *second* consumer appears.
 *
 * Pure: no React, no i18n.
 */
import type { Severity } from '@/core/ui/severity'

/**
 * The eight statuses carrying a `*Description` companion, in lifecycle order.
 * Selection does no work here — emptiness filters the rail (D-3), so an unused
 * status costs nothing and one that starts populating appears without a code
 * change. `availabilityStatus`, `paymentStatus`, `clearStatus` and
 * `acceptanceStatus` are unpopulated on all five captured documents and are kept
 * for exactly that reason.
 */
export const RAIL_STATUSES = [
  'readyStatus',
  'availabilityStatus',
  'approvalStatus',
  'paymentStatus',
  'deliveryStatus',
  'clearStatus',
  'acceptanceStatus',
  'closeStatus',
] as const

export type RailStatusKey = (typeof RAIL_STATUSES)[number]

/**
 * Keyed `(status, code)`, never by code alone: `'R'` is "Ready" on `readyStatus`
 * and "Close Requested" on `closeStatus` **on the same document**
 * (`8000000174`), so a single shared table cannot be written without lying on a
 * payload we already hold.
 *
 * Only codes observed on live data are here. Four rows is the honest extent of
 * what five captured documents support; `go` and `bad` are defined by
 * `core/ui/severity.ts` and deliberately unowned on this rail — `bad` awaits an
 * *executed* cancellation (a request is an outstanding decision, not a finished
 * one), `go` awaits a captured mid-flight `deliveryStatus`.
 */
const SEVERITY_BY_STATUS: Partial<Record<RailStatusKey, Readonly<Record<string, Severity>>>> = {
  readyStatus: { R: 'ok' },
  approvalStatus: { A: 'ok' },
  deliveryStatus: { D: 'ok' },
  closeStatus: { R: 'warn' },
}

/**
 * The severity for one coded status value.
 *
 * **Unmapped code ⇒ `mute`.** `warn` was considered and rejected: an
 * unrecognised code is the UI's ignorance, not the document's problem, and amber
 * would make the rail cry wolf every time the server adds a code.
 */
export function statusSeverity(status: RailStatusKey, code: string | null | undefined): Severity {
  const key = (code ?? '').trim().toUpperCase()
  if (!key) return 'mute'
  return SEVERITY_BY_STATUS[status]?.[key] ?? 'mute'
}

/**
 * Whether a `*Description` companion says nothing the code did not already say —
 * it is blank, or it merely echoes the code (`lastActionDescription: 'TRDY'` on
 * `9000000003`, 1 of 5 captures). True means the value renders as a raw code, in
 * monospace: the screen's established signal for *this is a code, not a word*.
 */
export function isCodeEcho(
  description: string | null | undefined,
  code: string | null | undefined,
): boolean {
  const text = (description ?? '').trim()
  if (!text) return true
  return text.toUpperCase() === (code ?? '').trim().toUpperCase()
}
