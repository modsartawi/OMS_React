import { useParams } from 'react-router'
import CollectionAcr from './CollectionAcr'
import PrintMiss from './PrintMiss'
import { usePrintPageA4 } from './print-page-rule'
import { findAcrFixture } from './acr-fixture'

/**
 * The ACR's print route — `/collection/acr/:acrId`.
 *
 * Its entire body IS the document (ticket 241): no AppShell, no nav, nothing
 * hidden behind `@media print`. The route sits outside `ProtectedLayout`'s chrome
 * for that reason and keeps its auth guard through `chromeless`, exactly as the
 * receipt's route does — the chrome is what differs, never the auth.
 *
 * ⚠ The DOCUMENT holds a three-rule exception (see `CollectionAcr.tsx`). This file
 * is chrome around it and holds none.
 *
 * No API (ticket 252's boundary): every `CollectionWeb` route answers a browser
 * 403 until the backend wave lands, so the id selects a checked-in fixture
 * scenario. Ticket 259 replaces `findAcrFixture` with the real call — and the miss
 * branch below is already the shape `AcrNotFound` needs (245 §7).
 */
export default function AcrPrintPage() {
  const { acrId } = useParams()
  // Route-scoped, deliberately: an `@page` rule in an imported stylesheet is
  // global and never unloaded. See `print-page-rule.ts`.
  usePrintPageA4()
  const acr = findAcrFixture(acrId)

  // Never a blank A4 sheet — a blank sheet prints as convincingly as a real one
  // (spec 249, story 91). Note the second clause is NOT the empty ACR: an ACR with
  // no rows is a real document that prints ONE page with `rows: []` (245 §7), and
  // `pages` is contractually never empty. It is there for the day 259 puts a real
  // payload behind this — a zero-page document would otherwise render a body with
  // nothing in it, which is the same lie told more quietly.
  if (!acr || acr.pages.length === 0) return <PrintMiss />

  // One A4 block per SERVER-paginated page. The client never chunks anything —
  // `rowsPerPage` rides on the contract as documentation of the break rule and is
  // deliberately not read here.
  return (
    <>
      {acr.pages.map((page, index) => (
        <CollectionAcr key={index} form={acr.form} page={page} />
      ))}
    </>
  )
}
