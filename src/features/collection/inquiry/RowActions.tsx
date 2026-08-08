import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import type { AcrInquiryRow, CollectionInquiryRow } from '@/core/models/collection'
import { acrFormHref, collectionsForAcrHref, receiptHref } from './acr-scope'

/**
 * The row actions — the seam where the four grids meet the two documents
 * (ticket 257).
 *
 * ⚠️ **A new tab, not an overlay, and the reason is twofold**: the grid keeps its
 * search, scroll and selection, and *a document becomes an address* that can be
 * pasted into a ticket or sent to a colleague. The WPF opens a second window to
 * the same effect. A side pane and an AG Grid master-detail row were both
 * considered and rejected — the latter is an **Enterprise** feature this repo does
 * not have (244 §8).
 *
 * 🚩 **Its own module, and its own column, deliberately.** The two field lists in
 * `collections-columns.ts` / `acr-columns.ts` carry a completeness proof — every
 * wire field appears in exactly one group — and 258's export writes their union.
 * An action is neither a field nor exportable, so folding it into those lists
 * would put a column of links into the accountant's CSV and weaken the assertion
 * that catches a dropped field. The Page composes the two.
 *
 * ⚠️ **Collection Attempts and Deposits get nothing from this file**, and that is
 * an argued absence rather than an omission: an attempt is immutable evidence
 * rather than a voucher (the WPF withholds a row action on purpose), and a deposit
 * has no printable document at all — its slips are ordinary links, delivered by
 * ticket 256.
 */

/** Shared shell: the action column itself is never sortable, filterable or
 *  exportable — it holds no value, only a way out of the row.
 *
 *  ⚠️ **`colId: 'actions'` is 258's handle, and 258 must use it.** AG Grid
 *  **Community** 36.0.1 has no `suppressCsvExport` on `ColDef` (checked, not
 *  assumed — it is not in the typings), so a CSV taken with `allColumns` would
 *  carry this column as a headed but empty one: it renders links and holds no cell
 *  value. Whichever writer 258 lands on excludes this colId. */
function actionColumn<Row>(headerName: string, cellRenderer: ColDef<Row>['cellRenderer']): ColDef<Row> {
  return {
    headerName,
    colId: 'actions',
    width: 190,
    sortable: false,
    filter: false,
    floatingFilter: false,
    resizable: false,
    cellRenderer,
  }
}

const LINK_CLASS =
  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10'

/**
 * A document link, or nothing at all when the row carries no id.
 *
 * 🚩 Drawing nothing is the honest branch, not a defensive one:
 * `CollectionReceiptId` is a server change still in flight (BackOffice 1089), so
 * the field can genuinely arrive blank, and a link built on `''` would land on a
 * route that does not match — a 404 dressed as a working action.
 *
 * ⚠️ `rel="noopener noreferrer"` alongside `target="_blank"`. The document route is
 * ours, so this is not the cross-origin case the Deposits slips are; it is the
 * house idiom, and it keeps the print tab from holding a handle on the grid.
 */
function NewTabLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {label}
      <ChevronRight className="h-3 w-3" aria-hidden />
    </a>
  )
}

/**
 * Cash Collections' `Receipt ▸` — opens `/collection/receipt/:collectionReceiptId`
 * in a new tab.
 */
export function buildReceiptActionColumn(t: TFunction): ColDef<CollectionInquiryRow> {
  return actionColumn<CollectionInquiryRow>(
    t('collections.actions.header'),
    (p: ICellRendererParams<CollectionInquiryRow>) => (
      <NewTabLink
        href={receiptHref(p.data?.collectionReceiptId)}
        label={t('collections.actions.receipt')}
      />
    ),
  )
}

/**
 * The ACRs grid's two actions: `Form ▸` opens the printable ACR in a **new tab**,
 * `Collections ▸` walks to Cash Collections scoped to that ACR in the **same** tab.
 *
 * 🚩 The second is a router `Link`, not an `<a>`: it is an in-app navigation
 * between two screens of the same feature, and a full document load would throw
 * away the app shell and re-run the access probe to arrive at the same place. The
 * first is an `<a>` precisely because it is *not* that — a print page is a fresh
 * document by design.
 *
 * ⚠️ `canOpenCollections` gates the drill-down, and a **ragged grant is a real
 * session**: the four grants are independent (253), so an account holding
 * `AcrInquiry` and not `CollectionInquiry` is ordinary rather than hypothetical.
 * Offering it the link would walk it, in its own tab, out of a grid it can read
 * and into a denial screen. The probe is already cached under
 * `COLLECTION_ACCESS_KEY`, so asking costs nothing.
 */
export function buildAcrActionsColumn(t: TFunction, canOpenCollections: boolean): ColDef<AcrInquiryRow> {
  return actionColumn<AcrInquiryRow>(
    t('acrs.actions.header'),
    (p: ICellRendererParams<AcrInquiryRow>) => {
      const collections = canOpenCollections ? collectionsForAcrHref(p.data?.acrId) : null
      return (
        <span className="flex items-center gap-1">
          <NewTabLink href={acrFormHref(p.data?.acrId)} label={t('acrs.actions.form')} />
          {collections && (
            <Link to={collections} className={LINK_CLASS}>
              {t('acrs.actions.collections')}
              <ChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          )}
        </span>
      )
    },
  )
}
