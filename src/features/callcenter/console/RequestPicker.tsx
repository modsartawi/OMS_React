/**
 * *The caller has an open request* — the picker that turns one into this order
 * (ticket 194).
 *
 * Four things this file exists to hold:
 *
 * 1. 🚩 **It is not `DocumentDetailsPage` and must not become it.** WPF drilled
 *    into its own OMS details screen with `ViewOnly = true`
 *    (`FindRequestController.cs:271-275`); the react page has **no view-only
 *    mode**, so reusing it would put change-store, reschedule and close-request
 *    under an agent's hand mid-call — and `features/callcenter → features/oms` is
 *    a boundary violation besides. The console needs the lines anyway in order to
 *    confirm them out loud, so the picker shows what it is about to copy and
 *    **links out** for the rare deep dig.
 * 2. **One press, one act.** Each row's *Link* is a single `linkRequest` carrying
 *    one `requestId`; the store, the items, the TMRA pickup + online and the
 *    source-reference prefill all arrive in the one `SessionState` it answers
 *    with. Nothing here loops `addItem`.
 * 3. 🚩 **The gate is a guard against the door shutting under an open picker** —
 *    an add landing in a second tab, a caller removed elsewhere. On the ordinary
 *    path the count block never offers a picker onto a shut gate at all, so this
 *    is not where an agent normally learns the link is refused; it is what stops a
 *    live *Link* from answering with `LINES_EXIST`. The controls go and the reason
 *    is said in their place.
 * 4. **No money.** The request is unpriced (880 §3), so the rows carry quantities
 *    and a UoM and no figure at all.
 *
 * It decides nothing: `linked-request.ts` holds the rules and `linkRequest`
 * answers with the whole projection.
 */
import { useTranslation } from 'react-i18next'
import { ExternalLink, Loader2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatShortDate } from '@/core/util/date-format'
import { NOTE } from './console-notes'
import type { LinkGate, RequestRow } from './linked-request'

export interface RequestPickerActions {
  /** The picked request's document number. The call, its `requestId` and the
   *  state it answers with are the page's. */
  onLink: (documentNo: string) => void
  /** Which request is being linked, or `null`. One at a time: one order converts
   *  one request. */
  pending: string | null
  /** The link's own failure, already worded by the caller. */
  error: string | null
}

export default function RequestPicker({
  open,
  rows,
  gate,
  actions,
  onClose,
}: {
  open: boolean
  rows: RequestRow[]
  gate: LinkGate
  actions: RequestPickerActions
  onClose: () => void
}) {
  const { t } = useTranslation('callcenter')
  const busy = actions.pending !== null
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t('request.title')}
      width="40rem"
      footer={
        <Button variant="text" onClick={onClose} disabled={busy} data-cc-request-close>
          {t('request.close')}
        </Button>
      }
    >
      <div className="space-y-3" data-cc-request-picker>
        {/* 🚩 Stated once, above the list: whatever shut the door under this open
            picker, an agent who cannot see why would read the missing buttons as a
            broken screen. */}
        {!gate.canLink && (
          <p className={NOTE.quiet} data-cc-request-shut={gate.reason ?? ''}>
            {t(gate.reason ? `request.shut.${gate.reason}` : 'request.shut.unknown', {
              defaultValue: t('request.shut.unknown'),
            })}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-cc-request-none>
            {t('request.none')}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <RequestCard
                key={row.documentNo}
                row={row}
                canLink={gate.canLink}
                pending={actions.pending === row.documentNo}
                busy={busy}
                onLink={() => actions.onLink(row.documentNo)}
              />
            ))}
          </ul>
        )}

        {actions.error && (
          <p className={NOTE.danger} data-cc-request-error>
            {actions.error}
          </p>
        )}
      </div>
    </Modal>
  )
}

/**
 * One request, with its lines — *"this is the Mounjaro you paid for on Tuesday"*
 * made confirmable without leaving the call.
 */
function RequestCard({
  row,
  canLink,
  pending,
  busy,
  onLink,
}: {
  row: RequestRow
  canLink: boolean
  pending: boolean
  busy: boolean
  onLink: () => void
}) {
  const { t } = useTranslation('callcenter')
  return (
    <li
      className="rounded-md border border-border bg-card p-3"
      data-cc-request-row={row.documentNo}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span data-numeric className="text-sm font-semibold">
              <Ltr>{row.documentNo}</Ltr>
            </span>
            {/* The deep dig, and the only thing this console says about the OMS
                details screen. A new tab, so the call keeps its console. */}
            <a
              href={row.href}
              target="_blank"
              rel="noreferrer"
              data-cc-request-open={row.documentNo}
              aria-label={t('request.openDocument')}
              title={t('request.openDocument')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {/* 🚩 The reason **in words**, and nothing at all where the server
                resolved none — the agent must never read `TMRA` to a caller. */}
            {row.reason && <span data-cc-request-reason={row.documentNo}>{row.reason}</span>}
            {row.reason && ' · '}
            <span data-cc-request-store={row.documentNo}>
              {t('request.raisedAt', { store: row.storeCode })}
            </span>
            {' · '}
            {/* 🚩 **When** — the half of *"this is the Mounjaro you paid for on
                Tuesday"* that the number and the reason cannot carry. A caller with
                two requests at the same store for the same reason is told apart by
                this and nothing else. */}
            <span data-cc-request-date={row.documentNo}>{formatShortDate(row.documentDate)}</span>
          </div>
        </div>
        {/* 🚩 Absent, not disabled, when the door would refuse — the console's
            standing posture. The reason is said once, above the list. */}
        {canLink && (
          <Button onClick={onLink} disabled={busy} data-cc-request-link={row.documentNo}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              t('request.link')
            )}
          </Button>
        )}
      </div>

      {/* What is about to land. Unpriced by construction: quantity and UoM, and
          no figure the agent could read as money. */}
      <ul className="mt-2 space-y-1 border-t border-border pt-2" data-cc-request-lines={row.documentNo}>
        {row.lines.map((line, index) => (
          <li
            key={`${line.itemNumber}-${index}`}
            className="flex items-baseline gap-2 text-xs"
            data-cc-request-line={line.itemNumber}
          >
            <span data-numeric className="text-muted-foreground">
              <Ltr>{line.itemNumber}</Ltr>
            </span>
            {/* Server-supplied text, passed through as data. */}
            <span className="min-w-0 flex-1 truncate">{line.description}</span>
            <span data-numeric className="shrink-0 font-medium">
              {t('request.qty', { qty: line.quantity, uom: line.uom })}
            </span>
          </li>
        ))}
      </ul>

      {/* The pharmacist's own words — shown, and copied onto no field of this
          order (880 §4.4): the same text on two documents, with words the agent
          cannot remove because they did not write them. */}
      {row.note && (
        <p className="mt-2 text-xs text-muted-foreground" data-cc-request-note={row.documentNo}>
          {t('request.noteFrom', { note: row.note })}
        </p>
      )}
    </li>
  )
}
