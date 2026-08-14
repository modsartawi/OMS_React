import type { TFunction } from 'i18next'

import { formatMoneyIn } from '@/core/money'
import type { SettlementEntry } from '@/core/models/settlement'

/**
 * The cells a settlement entry draws the same way **wherever it is drawn** — the
 * branch account's grid (269) and the cross-estate ledger's (270).
 *
 * Extracted at `/standards-review`'s third duplication: seven of the ledger's nine
 * columns were the account's, including both `valueFormatter`/`filterValueGetter`
 * pairs and the cancelled-remaining refusal. Two grids agreeing about an entry by
 * coincidence is exactly the shape that drifts — and the thing they would drift on
 * is what a status *means*, which is the one thing a branch will ask about.
 *
 * 🔑 Three rules ride in here, and each is a rule the pair must not disagree on:
 *
 * 1. **The kind and the status carry their Arabic beside the English** (D9) — عجز and
 *    فائض are domain vocabulary, not a translation, and they are what the branch's
 *    own till screen says.
 * 2. **The floating filter matches what is on screen, not the wire's enum.** A reader
 *    typing *Cancelled* into the filter row is typing what the cell says.
 * 3. 🚩 **A `CANCELLED` entry draws no Remaining**, though the wire still carries its
 *    full figure (269's finding, 0688/147). Drawing it would claim a branch owes
 *    money the headline has already refused to count.
 *
 * 🚩 Pure: the words come in as `t`, the row goes in as data. No React, no network.
 */

/** What a kind reads as — *"Shortage · عجز"*. Rule 1. */
export const entryKindLabel = (t: TFunction, kind: string | null | undefined): string =>
  kind ? t(`account.kind.${kind}`) : ''

/** What a status reads as. `CLOSED_OUT` says **written off** rather than consumed —
 *  a different fact about where the money went, and the one the branch will ask
 *  about. */
export const entryStatusLabel = (t: TFunction, status: string | null | undefined): string =>
  status ? t(`account.status.${status}`) : ''

/**
 * What the **Remaining** column draws — rule 3, in the one place both grids read it.
 *
 * The em dash rather than a blank: a cell with nothing in it reads as *not loaded*,
 * and this one is a deliberate refusal to state a figure.
 */
export function remainingCell(
  entry: Pick<SettlementEntry, 'status'> | null | undefined,
  value: number | null | undefined,
  currencyKey: string | null | undefined,
): string {
  if (!entry || entry.status === 'CANCELLED') return '—'
  return value === null || value === undefined ? '—' : formatMoneyIn(value, currencyKey)
}
