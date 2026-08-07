import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { FileX2 } from 'lucide-react'
import CollectionVoucher from './CollectionVoucher'
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
  const { t } = useTranslation('collection')
  const { collectionReceiptId } = useParams()
  // Route-scoped, deliberately: an `@page` rule in an imported stylesheet is
  // global and never unloaded. See `print-page-rule.ts`.
  usePrintPageA4()
  // Not named `document`: shadowing the global inside a renderer is a trap for the
  // next reader, not a style point.
  const voucher = findVoucherFixture(collectionReceiptId)

  // Never a blank A4 sheet — a blank sheet prints as convincingly as a real one
  // (spec 249, story 91).
  if (!voucher || voucher.pages.length === 0) {
    return (
      <div className="mx-auto mt-16 max-w-md p-6 text-center" role="alert">
        <FileX2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">{t('document.missingTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('document.missingHint')}</p>
      </div>
    )
  }

  // One A4 block per SERVER-paginated page. The client never chunks anything:
  // a multi-shift receipt arrives as several pages already stamped -1 / -2.
  return (
    <>
      {voucher.pages.map((page) => (
        <CollectionVoucher key={page.noText} page={page} />
      ))}
    </>
  )
}
