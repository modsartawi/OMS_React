/**
 * The BBY status reading (ticket 442): SAP's `KONBBYH.STATUS` codes, plus OMS's own `3`.
 * Shared by the BBY Inquiry, its Details modal and Bonus Buy Maintenance. It graduated
 * here from Maintenance's overview when the inquiry became the second reader, since a
 * feature may never import another feature. Pure: no React, no i18n. Every site resolves
 * the reading's label through `t()`.
 */
import type { Severity } from '@/core/ui/severity'

export type BbyStatusReading = 'activated' | 'planned' | 'tested' | 'deactivated' | 'unknown'

/**
 * SAP's status column: **blank** = Activated, `1` = Planned, `2` = Deactivated, and OMS's own
 * `3` = Tested (spec 2396, ADR 0063: inert at a till like Planned). Blank means a
 * PRESENT empty (or space-padded, as SAP pads) string. A missing field is `unknown`, never
 * Activated: while the wire shape is unconfirmed, a renamed field must not paint every bonus
 * buy as live at the tills. Any other code is `unknown` too, the retired A/I/D/X included,
 * never guessed into one of the four.
 */
export function readBbyStatus(code: string | null | undefined): BbyStatusReading {
  if (code == null) return 'unknown'
  const c = code.trim()
  if (c === '') return 'activated'
  if (c === '1') return 'planned'
  if (c === '2') return 'deactivated'
  if (c === '3') return 'tested'
  return 'unknown'
}

/** The order a status column sorts in: live first, then the way to live, then paused. */
export const BBY_STATUS_ORDER: readonly BbyStatusReading[] = ['activated', 'tested', 'planned', 'deactivated', 'unknown']

/** Sort two raw status codes by their reading (`BBY_STATUS_ORDER`), not by the codes themselves. */
export function compareBbyStatus(a: string | null | undefined, b: string | null | undefined): number {
  return BBY_STATUS_ORDER.indexOf(readBbyStatus(a)) - BBY_STATUS_ORDER.indexOf(readBbyStatus(b))
}

/** Activated prices at the tills (`ok`); Planned waits for a human (`warn`); Tested is ready
 *  to go live (`go`); paused and unknown are neutral. The label always renders beside the colour. */
export function bbyStatusSeverity(status: BbyStatusReading): Severity {
  if (status === 'activated') return 'ok'
  if (status === 'planned') return 'warn'
  if (status === 'tested') return 'go'
  return 'mute'
}
