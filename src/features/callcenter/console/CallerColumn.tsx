/**
 * The caller column (spec 983 D1/D2/D10, ticket 989) — the console's start column, the
 * caller first.
 *
 * Top to bottom, in the spec's order:
 *
 * 1. **The caller** (`CallerBar`): with nobody attached, the existing attach and sign-up
 *    flow; attached, the name, member number and **tier** — never points (D2).
 * 2. *(990's slot)* **Last orders** and **usually buys** land here, between the caller
 *    and the address book (`history`).
 * 3. **The address book**, as selectable cards (`AddressCards`), while the order delivers
 *    and a caller with a book is attached.
 * 4. **The location link** (574's `LocationLinkPanel`), moved here unchanged (D10). The
 *    page still mounts it keyed by the transaction, so a new order starts holding no link.
 *
 * The column owns the seating only. Every verb and every read arrives from the page, as
 * nodes, exactly as the centre's sections do.
 */
import type { ReactNode } from 'react'

export default function CallerColumn({
  caller,
  history,
  addressBook,
  locationLink,
}: {
  caller: ReactNode
  /** 990 — last orders and usually buys. */
  history?: ReactNode
  addressBook?: ReactNode
  locationLink?: ReactNode
}) {
  return (
    <div
      className="flex min-w-0 flex-col border-b border-border bg-card xl:min-h-0 xl:overflow-y-auto xl:border-e xl:border-b-0"
      data-cc-col="caller"
    >
      {caller}
      {history}
      {addressBook}
      {locationLink}
    </div>
  )
}
