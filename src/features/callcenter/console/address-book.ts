/**
 * The address book's two derivations — **what one entry reads as** and **how a
 * refusal is explained** — as one pure module, because they are the two things
 * the picker does with what the door answers.
 *
 * 🚩 **Nothing here derives a store.** The district→store rule runs server-side at
 * `setAddress` and the answer comes back in the projection (spec 160: *"two
 * derivations of which store serves this address is how the console and the
 * engine start disagreeing"*). This module composes a line of text and names a
 * refusal; it never looks at a district code and never picks a plant.
 *
 * The display line follows CC2's own composition
 * (`OrderSummaryVM.cs:60-69` — street, street 2, building, district, city, joined
 * with commas), so the address an agent reads out on the web is the address they
 * read out in the desktop client.
 *
 * ⚠️ It composes **book rows only**. The address that is ON the order arrives
 * already composed as `header.address.line` and the rail renders that, verbatim —
 * this module never re-composes it. Two sources, two shapes: the book read is
 * `CustomerAddressBookModel` (nested `BusinessAddress` fields, no line) and the
 * order's is the session projection (a line, no fields). A composed line reaching
 * a surface the projection already answers would be the second derivation this
 * file exists to avoid.
 */
import type { CustomerAddressBookEntry } from '@/core/models/callcenter'

export interface AddressChoice {
  /** What `setAddress` is given — the entry's identity on the wire. */
  addressNumber: string
  /**
   * Server-supplied label text (`Home`, `Work`), or `null` when the row carries
   * none. Never a key: the picker owns the wording for an unlabelled address.
   *
   * The `labelNameEn ?? labelCode` fallback is CC2's own
   * (`OrderSummaryVM.cs:57`) and is kept deliberately: the agents moving off the
   * desktop client already read that code on rows whose label was never
   * translated, and showing them something different for the same address would
   * be a worse surprise than showing them what they know.
   */
  label: string | null
  /** The composed line, server text throughout. `null` when the row has nothing
   *  to compose from — which is a real (bad) row, not a reason to hide it. */
  line: string | null
  isDefault: boolean
  /** Already on the order. The picker says so rather than offering it as a
   *  change: re-applying the address the order already holds is a wasted verb. */
  isCurrent: boolean
}

/**
 * The book, ordered for the eye that has to pick from it in seconds: the
 * customer's **default first**, everything else in the order the server sent.
 *
 * Stable rather than clever — the same caller's book must not reshuffle between
 * two calls, which is why nothing here sorts by recency or by name.
 *
 * A row with no `addressNumber` is dropped: it is unpickable by construction
 * (there is nothing to send), and drawing it would offer the agent a control
 * that answers with nothing.
 */
export function addressChoices(
  entries: CustomerAddressBookEntry[] | null | undefined,
  currentAddressNumber: string | null,
): AddressChoice[] {
  const rows = (entries ?? []).filter((entry) => Boolean(entry?.addressNumber))
  const ordered = [...rows.filter((e) => e.isDefault), ...rows.filter((e) => !e.isDefault)]

  return ordered.map((entry) => ({
    addressNumber: entry.addressNumber,
    label: text(entry.labelNameEn) ?? text(entry.labelCode),
    line: addressLine(entry),
    isDefault: Boolean(entry.isDefault),
    isCurrent: entry.addressNumber === currentAddressNumber,
  }))
}

/** CC2's own piece order, blank parts dropped rather than punctuated. */
function addressLine(entry: CustomerAddressBookEntry): string | null {
  const a = entry.address
  if (!a) return null
  const pieces = [a.street1, a.street2, a.buildingNumber, a.districtName, a.cityName]
    .map(text)
    .filter((piece): piece is string => piece !== null)
  return pieces.length > 0 ? pieces.join(', ') : null
}

const text = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/**
 * The two refusals the address door has of its own (§6.3 / §7), each mapped to
 * the sentence that **explains** it.
 *
 * 🚩 Neither may reach the agent as a raw code, and neither may read as *"not
 * found"* — the contract is explicit that the distinction matters to support: an
 * address act before a caller is attached is an ordering problem the agent can
 * fix in one step, and an address belonging to **someone else** is a data problem
 * somebody has to hear about. Collapsing them into one empty list would lose
 * both.
 *
 * Anything else is not this module's to explain: the caller falls back to the
 * server's own `message` through `apiErrorMessage`, which is the rule for every
 * other refusal on this screen.
 */
const REFUSAL_KEY: Record<string, string> = {
  NO_CUSTOMER_ATTACHED: 'address.refusedNoCaller',
  ADDRESS_NOT_FOR_CUSTOMER: 'address.refusedNotTheirs',
  // 🚩 Added by 187, and it is the district picker's own refusal rather than the
  // book's: the editor greys a store-less district, but the SERVER's answer is
  // the authority (§2.3) and it is the one an agent meets after keying a whole
  // address. The sentence says what is true in both shapes it arrives in — a
  // plain pick and a create's auto-apply — so it claims nothing about the book:
  // the ORDER is unchanged either way, and it is the order the agent is asking
  // about.
  NO_DELIVERY_STORE_FOR_DISTRICT: 'address.refusedNoDeliveryStore',
}

export function addressRefusalKey(code: string | null | undefined): string | null {
  return (code && REFUSAL_KEY[code]) ?? null
}
