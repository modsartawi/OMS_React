import { useParams } from 'react-router'
import CollectionVoucher from './CollectionVoucher'
import PrintMiss from './PrintMiss'
import { usePrintPageA4 } from './print-page-rule'
import { findVoucherFixture } from './voucher-fixture'

/**
 * The collection receipt's print route — `/collection/receipt/:collectionReceiptId`.
 *
 * Its entire body IS the document (ticket 241): no AppShell, no nav, nothing
 * hidden behind `@media print`. The route sits outside `ProtectedLayout`'s
 * chrome for that reason and keeps its auth guard through `chromeless`.
 *
 * ⚠ The DOCUMENT holds a three-rule exception (see `CollectionVoucher.tsx`).
 * This file is chrome around it and holds none: the miss state below goes
 * through `t()`, logical utilities and tokens like every other screen.
 *
 * No API (ticket 251's boundary): every `CollectionWeb` route answers a browser
 * 403 until the backend wave lands, so the id selects a checked-in fixture
 * scenario. Ticket 259 replaces `findVoucherFixture` with the real call — and
 * the miss branch below is already the shape `CollectionReceiptNotFound` needs.
 */
export default function ReceiptPrintPage() {
  const { collectionReceiptId } = useParams()
  // Route-scoped, deliberately: an `@page` rule in an imported stylesheet is
  // global and never unloaded. See `print-page-rule.ts`.
  usePrintPageA4()
  // Not named `document`: shadowing the global inside a renderer is a trap for the
  // next reader, not a style point.
  const voucher = findVoucherFixture(collectionReceiptId)

  // Never a blank A4 sheet — a blank sheet prints as convincingly as a real one
  // (spec 249, story 91). The sentence moved to `PrintMiss` at ticket 252, which
  // renders the same one for a stale ACR link.
  if (!voucher || voucher.pages.length === 0) return <PrintMiss />

  // One A4 block per SERVER-paginated page. The client never chunks anything:
  // a multi-shift receipt arrives as several pages already stamped -1 / -2.
  return (
    <>
      {/* Keyed by POSITION, not by `noText`: page order is contractual (the
          shift's OpenedAt ascending) and the list never reorders or filters, so
          the index is stable — while `noText` is a server string that 245 §3
          records as historically DUPLICATED across a multi-shift receipt's
          pages, which is the bug the `-1`/`-2` suffix exists to fix. If it ever
          reaches the browser unfixed, a keyed-by-value list collides silently. */}
      {voucher.pages.map((page, index) => (
        <CollectionVoucher key={index} page={page} />
      ))}
    </>
  )
}
