import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { MessageCircleQuestion, PackageCheck } from 'lucide-react'

import StatusBadge from '@/core/ui/StatusBadge'
import type { AuthListRow } from '@/core/models/nphies'
import RowActs from './RowActs'
import type { AuthAct } from './row-acts'
import { formatStamp } from '@/core/nphies/format'
import {
  authRowMarkers,
  authVerdictSeverity,
  deriveAuthAxes,
  requestSeverity,
  showsFailureMessage,
} from '@/core/nphies/status'

/**
 * The authorization list's columns (ticket 214). Both status axes render through
 * the **same** `@/core/nphies/status` module the eligibility list and the check
 * result use — only the Verdict's value set differs — so an agent learns one
 * vocabulary and not two.
 *
 * Nothing here re-decides anything. The axes come from `deriveAuthAxes`, the two
 * markers from `authRowMarkers`, and whether the message field may be read at all
 * from `showsFailureMessage`. This file only wires those to cells.
 *
 * 🚩 **No column asserts "ready to dispense."** The real predicate lives in the
 * service's `Dispense()` and its `HasFollowUp` clause is absent from
 * `AuthForListDto` (§5), so a browser copy could only lie on some rows. The reader
 * infers it from what is already here: `Complete`, a good verdict, no dispensed
 * marker.
 *
 * Sorting and paging are the **server's** (§3.3), so no column is client-sortable
 * and no column filter is offered: a sort over the 50 rows of page 3 would
 * reorder a page, not the result, which is the same class of lie the invisible
 * window is.
 */

/** Every column: read-only, resizable, and neither sortable nor filterable
 *  client-side — see the note above. */
export const AUTH_LIST_DEFAULT_COL_DEF: ColDef<AuthListRow> = {
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

/**
 * Where a fired act goes (ticket 215).
 *
 * 🚩 It must be a **stable** reference for the life of the screen, and nothing
 * else about the acts may travel through the column definitions: AG Grid rebuilds
 * every cell when `columnDefs` changes identity, which throws keyboard focus to
 * the document body mid-act. The in-flight state is rendered above the grid for
 * exactly that reason.
 */
export type AuthListOnAct = (act: AuthAct, row: AuthListRow) => void

export function buildAuthListColumns(t: TFunction, onAct: AuthListOnAct): ColDef<AuthListRow>[] {
  return [
    {
      headerName: t('list.columns.actionDateTime'),
      field: 'actionDateTime',
      width: 155,
      // Newest first is the server's order; this column is where the agent reads
      // the window they can see in the chip above.
      valueFormatter: (p: ValueFormatterParams<AuthListRow, string>) => formatStamp(p.value),
    },
    {
      // 🚩 `patientId` alone: `AuthForListDto` carries **no patient name**, unlike
      // the eligibility row. A name column would either be blank on every row or
      // sourced from a field the endpoint does not answer with.
      headerName: t('list.columns.patientId'),
      field: 'patientId',
      width: 150,
    },
    { headerName: t('list.columns.payerCode'), field: 'payerCode', width: 110 },
    { headerName: t('list.columns.providerCode'), field: 'providerCode', width: 120 },
    {
      // The payer's own reference — what an agent is quoted on the phone, and the
      // one free-text filter this list has that the eligibility list cannot.
      headerName: t('list.columns.preAuthRef'),
      field: 'preAuthRef',
      width: 170,
    },
    {
      // Axis one: did we get an answer at all.
      headerName: t('list.columns.request'),
      colId: 'request',
      width: 130,
      cellRenderer: (p: ICellRendererParams<AuthListRow>) => {
        if (!p.data) return null
        const { request } = deriveAuthAxes(p.data)
        return <StatusBadge sev={requestSeverity(request)}>{t(`request.${request}`)}</StatusBadge>
      },
    },
    {
      // Axis two: what they said. Blank until Request is Complete, and the blank
      // is the honest rendering — a request that never reached the payer has no
      // verdict to report.
      headerName: t('list.columns.verdict'),
      colId: 'verdict',
      width: 165,
      cellRenderer: (p: ICellRendererParams<AuthListRow>) => {
        if (!p.data) return null
        const { verdict } = deriveAuthAxes(p.data)
        if (!verdict) {
          return (
            <span className="text-muted-foreground" aria-label={t('list.verdictBlank')}>
              —
            </span>
          )
        }
        return (
          <StatusBadge sev={authVerdictSeverity(verdict)}>{t(`verdict.${verdict}`)}</StatusBadge>
        )
      },
    },
    {
      // 🚩 The two markers, in their OWN column and rendered from the row's own
      // booleans — never from the axes. A payer query lands asynchronously and can
      // sit on a row that is already Complete with a verdict, which is exactly why
      // it cannot be a value of either axis. It is required rather than
      // decorative: answering one is out of v1, so the row stalls on the web and
      // the agent has to be able to see that it now needs the till application.
      headerName: t('list.columns.markers'),
      colId: 'markers',
      width: 170,
      cellRenderer: (p: ICellRendererParams<AuthListRow>) => {
        if (!p.data) return null
        const markers = authRowMarkers(p.data)
        if (!markers.payerQuery && !markers.dispensed) {
          return (
            <span className="text-muted-foreground" aria-label={t('list.markers.none')}>
              —
            </span>
          )
        }
        return (
          <span className="flex items-center gap-1.5">
            {markers.payerQuery && (
              <span title={t('list.markers.payerQueryHint')}>
                <StatusBadge sev="warn">
                  <MessageCircleQuestion className="me-1 h-3 w-3" aria-hidden />
                  {t('list.markers.payerQuery')}
                </StatusBadge>
              </span>
            )}
            {markers.dispensed && (
              <span title={t('list.markers.dispensedHint')}>
                <StatusBadge sev="mute">
                  <PackageCheck className="me-1 h-3 w-3" aria-hidden />
                  {t('list.markers.dispensed')}
                </StatusBadge>
              </span>
            )}
          </span>
        )
      },
    },
    {
      // 🚩 §5's dual-meaning field, read in exactly one branch and headed for it.
      // `ErrorMessageShort` carries a transport error OR the decoded adjudication
      // display depending on branch (`ProcessAuthResponse.cs:53-65` fills it from
      // transport codings; only if that left it empty does `:120` fill it from
      // `GetAdjudicationOutcomeDisplay`). A neutral "Message" column would
      // re-conflate precisely what the two axes exist to keep apart. On a
      // `Complete` row this cell is empty however much the field holds — the
      // payer's words come from the disposition and, at the detail, per-line
      // reasons.
      headerName: t('list.columns.failureReason'),
      field: 'errorMessageShort',
      flex: 1,
      minWidth: 200,
      valueGetter: (p) =>
        p.data && showsFailureMessage(deriveAuthAxes(p.data).request) ? p.data.errorMessageShort : '',
    },
    {
      // 🚩 The acts (215), state-driven and each withheld one carrying its reason.
      // Last, and pinned to the end of the row: they are what an agent does about
      // what the columns before them say, and reading comes before acting.
      headerName: t('list.columns.acts'),
      colId: 'acts',
      // Wide enough for all four buttons and their gaps at the widest label the
      // namespace carries — a clipped act is an act an agent cannot read.
      width: 470,
      // No flex: the four acts are a fixed set, so the column is a fixed width
      // and the failure reason beside it is what absorbs the remaining space.
      cellRenderer: (p: ICellRendererParams<AuthListRow>) =>
        p.data ? <RowActs row={p.data} t={t} onAct={onAct} /> : null,
    },
  ]
}
