import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { apiErrorMessage } from '@/core/api'
import CollectionAcr from './CollectionAcr'
import PrintMiss, { PrintFailure, PrintPending } from './PrintMiss'
import { ACR_NOT_FOUND, collectionApi } from './api'
import { printOutcome } from './print-outcome'
import { usePrintPageA4 } from './print-page-rule'

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
 * **Ticket 259 joined this to the real door** — `CollectionWeb/AcrForm/{acrId}`
 * (BackOffice 1093). ⚠ And the trap this route carries and the receipt's does not:
 * **an ACR with no linked collections is a SUCCESS**, a 200 with one page and
 * `rows: []`, which prints its sheet with totals `0.00`. Only an unknown id
 * refuses, with `AcrNotFound`. That is why the branch below is `printOutcome`'s
 * and not a row count.
 */
export default function AcrPrintPage() {
  const { acrId } = useParams()
  const { t } = useTranslation('collection')
  // Route-scoped, deliberately: an `@page` rule in an imported stylesheet is
  // global and never unloaded. See `print-page-rule.ts`.
  usePrintPageA4()

  const query = useQuery({
    queryKey: ['collection', 'acr-form', acrId],
    queryFn: () => collectionApi.acrForm(acrId!),
    enabled: !!acrId,
    // A miss is an ANSWER, not an outage; a printed form is a record of a moment.
    // Same three settings as the receipt route, for the same three reasons.
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const acr = query.data
  const outcome = printOutcome(
    { isPending: query.isPending, error: query.error, data: acr },
    ACR_NOT_FOUND,
  )

  // Never a blank A4 sheet — a blank sheet prints as convincingly as a real one
  // (spec 249, story 91). Every branch draws a sentence; none returns null.
  if (outcome === 'pending') return <PrintPending />
  if (outcome === 'miss') return <PrintMiss />
  if (outcome === 'failure')
    return <PrintFailure message={apiErrorMessage(query.error, t('document.failedFallback'))} />

  // One A4 block per SERVER-paginated page. The client never chunks anything —
  // `rowsPerPage` rides on the contract as documentation of the break rule and is
  // deliberately not read here.
  return (
    <>
      {acr!.pages.map((page, index) => (
        <CollectionAcr key={index} form={acr!.form} page={page} />
      ))}
    </>
  )
}
