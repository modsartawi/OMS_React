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
export default function CheckResult({ response }: { response: EligibilityCheckResponse }) {
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

      {/* Every policy the patient holds, read-only. Choosing between them is
          213's ticket and nothing here selects one — but the coverages arrive on
          this very response (§3.1), and a result that hid them would read as
          though the patient holds no policy at all. */}
      <div>
        <div className="text-xs font-medium text-muted-foreground">
          {t('result.coverages', { count: response.coverages?.length ?? 0 })}
        </div>
        {(response.coverages ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('result.noCoverages')}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {response.coverages.map((c, i) => (
              // Keyed by position as well as identity: `Id` and `MemberId` are
              // both nullable on `EligibilityCoverageResponse`, and two blank-id
              // coverages under one member id would otherwise collide.
              <li
                key={`${c.id}-${c.memberId}-${i}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border/60 p-2 text-sm"
              >
                <span className="font-medium">{c.memberId}</span>
                <StatusBadge sev={c.inForce ? 'ok' : 'mute'}>
                  {c.inForce ? t('coverage.inForce') : t('coverage.notInForce')}
                </StatusBadge>
                <span className="text-muted-foreground">
                  {t('coverage.network', { network: c.network })}
                </span>
                <span className="text-muted-foreground">
                  {t('coverage.plan', { plan: c.coveragePlan })}
                </span>
                <span className="text-muted-foreground">
                  {t('coverage.class', { className: c.coverageClass })}
                </span>
                <span className="text-muted-foreground">
                  {t('coverage.policyHolder', { policyHolder: c.policyHolderName })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
