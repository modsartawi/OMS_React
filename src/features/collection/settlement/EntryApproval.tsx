import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Hourglass, Ban } from 'lucide-react'

import Button from '@/core/ui/Button'
import { formatDateTime } from '@/core/util/date-format'
import type { AccountEntryRow } from './account-projection'
import { approvalFor, approvalTarget } from './approval'
import ApprovalDialog, { type ApprovalRequest } from './ApprovalDialog'

/**
 * **The approval panel** on a branch account — what the selected entry's wait for a
 * supervisor looks like, above the correction panel (ticket 309).
 *
 * Three faces, all from `approvalFor`, and nothing drawn for an entry that never waited:
 *
 * - **waiting** (an accountant) — the entry is pending, no till can see it, and it is
 *   in none of the figures above. Said out loud, because a surplus the accountant just
 *   posted that the branch cannot use yet is the first thing they will be rung about
 *   (story 6).
 * - **decide** (a supervisor) — the same sentence, and **Approve** / **Reject**, which
 *   open the one `ApprovalDialog` the queue opens too.
 * - **rejected** (anyone) — who refused it, when, and the reason, which is what the
 *   accountant needs to post a corrected entry (story 7).
 *
 * 🚩 It never tests a status itself — `approval.ts` decides, this draws.
 */
export default function EntryApproval({
  row,
  storeName,
  currencyKey,
  canSupervise,
}: {
  row: AccountEntryRow | null
  storeName: string
  currencyKey: string
  /** `canSuperviseSettlement` off the area's one probe — hides buttons, guards nothing. */
  canSupervise: boolean
}) {
  const { t } = useTranslation('settlement')
  const [request, setRequest] = useState<ApprovalRequest | null>(null)

  const state = approvalFor(row, canSupervise)
  if (!row || state.kind === 'none') return null

  const target = approvalTarget(row, storeName, currencyKey)

  return (
    <section
      data-region="entry-approval"
      data-entry={row.entryNumber}
      data-approval={state.kind}
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{t('approval.panel.title')}</h2>
        <span className="font-mono text-[12px] text-muted-foreground">
          {t('approval.panel.forEntry', { number: row.entryNumber })}
        </span>
      </header>

      {state.kind === 'rejected' ? (
        <div className="flex flex-col gap-1.5 text-sm" data-testid="approval-rejected">
          <p className="flex items-start gap-2">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              {state.at
                ? t('approval.panel.rejectedAt', { by: state.by, at: formatDateTime(state.at) })
                : t('approval.panel.rejected', { by: state.by })}
            </span>
          </p>
          {/* 🔑 The supervisor's reason, verbatim — the thing the accountant came here to
              read. Server text, routinely Arabic, so `dir="auto"` on its own element. */}
          <blockquote
            dir="auto"
            className="rounded-md border border-border/60 bg-muted/30 p-2.5"
            data-testid="approval-rejected-reason"
          >
            {state.reason || t('approval.panel.noReason')}
          </blockquote>
          <p className="text-xs text-muted-foreground">{t('approval.panel.rejectedNext')}</p>
        </div>
      ) : (
        <>
          <p className="flex items-start gap-2 text-sm" data-testid="approval-waiting">
            <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{t('approval.panel.waiting', { number: row.entryNumber })}</span>
          </p>
          {state.kind === 'decide' && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => setRequest({ target, act: 'approve' })}
                data-testid="approval-open-approve"
              >
                {t('approval.approve.button')}
              </Button>
              <Button
                variant="danger-outlined"
                onClick={() => setRequest({ target, act: 'reject' })}
                data-testid="approval-open-reject"
              >
                {t('approval.reject.button')}
              </Button>
            </div>
          )}
        </>
      )}

      <ApprovalDialog request={request} onClose={() => setRequest(null)} />
    </section>
  )
}
