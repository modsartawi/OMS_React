import { useTranslation } from 'react-i18next'

import StatusBadge from '@/core/ui/StatusBadge'
import {
  deriveEligibilityAxes,
  eligibilityVerdictSeverity,
  requestSeverity,
  showsFailureMessage,
  verdictCellKeys,
} from '@/core/nphies/status'
import type { EligibilityCheckResponse } from '@/core/models/nphies'
import CoverageList from './CoverageList'

/**
 * The answer to one eligibility check, in two axes (ticket 211, contract §5).
 *
 * Its own file rather than the form's, because it changes for a different
 * reason: the form is about what the agent supplies, this is about what came
 * back — and 212's list will render the same pair from a different row shape.
 *
 * 🚩 **The Verdict is ONE cell.** Site eligibility renders inside the same badge
 * as the verdict it qualifies — "Eligible · outside network" — because an agent
 * who reads a verdict and learns about the network later has learned it too late
 * (§3.1). The parts come from `verdictCellKeys`, so what that cell contains is
 * not decided here.
 */
export default function CheckResult({
  response,
  coverages = true,
}: {
  response: EligibilityCheckResponse
  /**
   * `false` on the response detail (213), which renders the same coverages as a
   * **picker** in its own section — with the pick rule and the seam to the
   * authorization form attached. Suppressing the read-only copy here is what
   * stops one screen listing the patient's policies twice.
   */
  coverages?: boolean
}) {
  const { t } = useTranslation('eligibility')
  const axes = deriveEligibilityAxes(response)
  const cell = verdictCellKeys(axes)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('result.request')}</span>
          <StatusBadge sev={requestSeverity(axes.request)}>
            {t(`request.${axes.request}`)}
          </StatusBadge>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('result.verdict')}</span>
          {axes.verdict ? (
            <StatusBadge sev={eligibilityVerdictSeverity(axes.verdict)}>
              {cell.map((key) => t(key)).join(t('result.verdictJoin'))}
            </StatusBadge>
          ) : (
            // Blank until Complete — the honest rendering of "nothing to report
            // yet", and never an implied refusal.
            <span className="text-sm text-muted-foreground" aria-label={t('result.verdictBlank')}>
              —
            </span>
          )}
        </div>
      </div>

      {/* The dual-meaning field, read in exactly one branch and labelled for it.
          §5 puts BOTH `Failed` and `Pending` under the failure label and forbids
          it entirely on `Complete`, where the payer's own words arrive in the
          disposition instead. A neutral "Message" label here would re-conflate
          exactly what the two axes exist to keep apart. */}
      {showsFailureMessage(axes.request) && response.errorMessage && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{t('result.failureLabel')}</div>
          <p className="text-sm text-foreground">{response.errorMessage}</p>
        </div>
      )}

      {axes.verdict === 'notInForce' && response.notInForceReason && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t('result.notInForceReason')}
          </div>
          <p className="text-sm text-foreground">{response.notInForceReason}</p>
        </div>
      )}

      {axes.request === 'complete' && response.disposition && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{t('result.disposition')}</div>
          <p className="text-sm text-foreground">{response.disposition}</p>
        </div>
      )}

      {/* Every policy the patient holds. On the check form they are read-only —
          choosing between them is the DETAIL's act (213), where the seam to the
          authorization form lives. But the coverages arrive on this very response
          (§3.1), and a result that hid them would read as though the patient
          holds no policy at all.

          Rendered through the shared `CoverageList` so the two screens state the
          same six facts and cannot drift. */}
      {coverages !== false && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t('result.coverages', { count: response.coverages?.length ?? 0 })}
          </div>
          <CoverageList coverages={response.coverages ?? []} />
        </div>
      )}
    </section>
  )
}
