import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { apiErrorMessage } from '@/core/api'
import CollectionVoucher from './CollectionVoucher'
import PrintMiss, { PrintFailure, PrintPending } from './PrintMiss'
import { collectionApi, RECEIPT_NOT_FOUND } from './api'
import { printOutcome } from './print-outcome'
import { usePrintPageA4 } from './print-page-rule'

/**
 * The collection receipt's print route — `/collection/receipt/:collectionReceiptId`.
 *
 * Its entire body IS the document (ticket 241): no AppShell, no nav, nothing
 * hidden behind `@media print`. The route sits outside `ProtectedLayout`'s
 * chrome for that reason and keeps its auth guard through `chromeless`.
 *
 * ⚠ The DOCUMENT holds a three-rule exception (see `CollectionVoucher.tsx`).
 * This file is chrome around it and holds none: the three non-document states
 * below go through `t()`, logical utilities and tokens like every other screen.
 *
 * **Ticket 259 joined this to the real door.** Until then the id selected a
 * checked-in fixture, because every `CollectionWeb` route answered a browser 403;
 * `CollectionWeb/Receipt/{collectionReceiptId}` (BackOffice 1091) now answers it,
 * and the fixtures stayed in the repo as the drives' test data.
 */
export default function ReceiptPrintPage() {
  const { collectionReceiptId } = useParams()
  const { t } = useTranslation('collection')
  // Route-scoped, deliberately: an `@page` rule in an imported stylesheet is
  // global and never unloaded. See `print-page-rule.ts`.
  usePrintPageA4()

  const query = useQuery({
    queryKey: ['collection', 'receipt', collectionReceiptId],
    // The route cannot match without the segment, so the `!` is the router's
    // guarantee rather than an assumption — and `enabled` keeps the call from
    // firing on the impossible case instead of asking the server about "".
    queryFn: () => collectionApi.receipt(collectionReceiptId!),
    enabled: !!collectionReceiptId,
    // A miss is an ANSWER, not an outage — the same reasoning as the access
    // probe. Retrying a stale link three times only delays the sentence that
    // tells the user it is stale.
    retry: false,
    // A printed receipt is a record of a moment: it cannot change under the
    // reader, and a refetch while the print dialog is open would be a re-render
    // mid-print.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  // Not named `document`: shadowing the global inside a renderer is a trap for the
  // next reader, not a style point.
  const voucher = query.data
  const outcome = printOutcome(
    { isPending: query.isPending, error: query.error, data: voucher },
    RECEIPT_NOT_FOUND,
  )

  // Never a blank A4 sheet — a blank sheet prints as convincingly as a real one
  // (spec 249, story 91). Every branch here draws a sentence; there is no path
  // that returns null.
  if (outcome === 'pending') return <PrintPending />
  if (outcome === 'miss') return <PrintMiss />
  if (outcome === 'failure')
    return <PrintFailure message={apiErrorMessage(query.error, t('document.failedFallback'))} />

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
      {voucher!.pages.map((page, index) => (
        <CollectionVoucher key={index} page={page} />
      ))}
    </>
  )
}
