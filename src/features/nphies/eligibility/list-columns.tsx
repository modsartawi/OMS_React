import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import StatusBadge from '@/core/ui/StatusBadge'
import type { EligibilityListRow } from '@/core/models/nphies'
import { formatStamp } from './format'
import {
  deriveStoredEligibilityAxes,
  eligibilityVerdictSeverity,
  requestSeverity,
  showsFailureMessage,
  verdictCellKeys,
} from '@/core/nphies/status'

/**
 * The eligibility list's columns (ticket 212). Both status axes render through
 * the **shared** module in `@/core/nphies/status` — the same derivation the check
 * result uses and 214's authorization list will reuse — so an agent learns one
 * vocabulary and not two.
 *
 * Nothing here re-decides anything. The axes come from
 * `deriveStoredEligibilityAxes` — the **stored-row** entry point, because a
 * persisted row carries no `Outcome` column and the live reading would report
 * every completed check as still waiting — the verdict cell's parts from
 * `verdictCellKeys`, and whether the message field may be read at all from
 * `showsFailureMessage`. This file only wires those to cells.
 *
 * Sorting and paging are the **server's** (§3.3), so no column is client-sortable
 * and no column filter is offered: a sort over the 50 rows of page 3 would
 * reorder a page, not the result, which is the same class of lie the invisible
 * window is.
 */

/** Every column: read-only, resizable, and neither sortable nor filterable
 *  client-side — see the note above. */
export const ELIGIBILITY_LIST_DEFAULT_COL_DEF: ColDef<EligibilityListRow> = {
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

export function buildEligibilityListColumns(t: TFunction): ColDef<EligibilityListRow>[] {
  return [
    {
      // 🚩 The way into the detail (213), and it is a real anchor rather than a
      // row-click handler: spec 209 story 9 asks for a response that can be
      // LINKED to, which means right-clickable, copyable and middle-clickable.
      // A row handler is none of those.
      headerName: t('list.columns.open'),
      colId: 'open',
      width: 90,
      cellRenderer: (p: ICellRendererParams<EligibilityListRow>) =>
        p.data?.id ? (
          <Link
            to={`/nphies/eligibility/${encodeURIComponent(p.data.id)}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {t('list.open')}
          </Link>
        ) : null,
    },
    {
      headerName: t('list.columns.actionDateTime'),
      field: 'actionDateTime',
      width: 160,
      // Newest first is the server's order; this column is where the agent reads
      // the window they can see in the chip above.
      valueFormatter: (p: ValueFormatterParams<EligibilityListRow, string>) => formatStamp(p.value),
    },
    {
      headerName: t('list.columns.patient'),
      field: 'patientName',
      width: 220,
      cellRenderer: (p: ICellRendererParams<EligibilityListRow>) =>
        p.data ? (
          <span className="flex flex-col leading-tight">
            <span>{p.data.patientName}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{p.data.patientId}</span>
          </span>
        ) : null,
    },
    { headerName: t('list.columns.payerCode'), field: 'payerCode', width: 120 },
    {
      headerName: t('list.columns.providerCode'),
      field: 'providerCode',
      width: 130,
    },
    {
      // Axis one: did we get an answer at all.
      headerName: t('list.columns.request'),
      colId: 'request',
      width: 130,
      cellRenderer: (p: ICellRendererParams<EligibilityListRow>) => {
        if (!p.data) return null
        const { request } = deriveStoredEligibilityAxes(p.data)
        return <StatusBadge sev={requestSeverity(request)}>{t(`request.${request}`)}</StatusBadge>
      },
    },
    {
      // Axis two: what they said — ONE cell, with the site qualifier folded in
      // ("Eligible · outside network") exactly as on the check result. Blank
      // until Request is Complete, and the blank is the honest rendering.
      headerName: t('list.columns.verdict'),
      colId: 'verdict',
      width: 210,
      cellRenderer: (p: ICellRendererParams<EligibilityListRow>) => {
        if (!p.data) return null
        const axes = deriveStoredEligibilityAxes(p.data)
        if (!axes.verdict) {
          return (
            <span className="text-muted-foreground" aria-label={t('result.verdictBlank')}>
              —
            </span>
          )
        }
        return (
          <StatusBadge sev={eligibilityVerdictSeverity(axes.verdict)}>
            {verdictCellKeys(axes)
              .map((key) => t(key))
              .join(t('result.verdictJoin'))}
          </StatusBadge>
        )
      },
    },
    {
      // 🚩 §5's dual-meaning field, read in exactly one branch and headed for it.
      // `errorMessage` carries a transport error OR the decoded adjudication
      // display depending on branch, so a neutral "Message" column would
      // re-conflate precisely what the two axes exist to keep apart. On a
      // `Complete` row this cell is empty however much the field holds.
      headerName: t('list.columns.failureReason'),
      field: 'errorMessage',
      flex: 1,
      minWidth: 200,
      valueGetter: (p) =>
        p.data && showsFailureMessage(deriveStoredEligibilityAxes(p.data).request)
          ? p.data.errorMessage
          : '',
    },
  ]
}
