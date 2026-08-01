import { useTranslation } from 'react-i18next'

import StatusBadge from '@/core/ui/StatusBadge'
import type { EligibilityCoverage } from '@/core/models/nphies'

/**
 * Every policy the patient holds — member id, in-force, network, plan, class and
 * policy holder (spec 209 story 18).
 *
 * One component, two screens. The check result (211) renders it read-only; the
 * response detail (213) renders it **selectable**, because choosing a policy is
 * choosing which member id an authorization is raised under. A second copy would
 * drift the moment one of them gained a field, and the agent would be learning
 * two vocabularies for one fact.
 *
 * Selectable is decided by the presence of `onPick`, not by a flag: a list with a
 * handler and no way to use it, or a flag with no handler, are both states that
 * cannot occur.
 *
 * 🚩 **Nothing here decides what is selected.** The rule — one is auto-selected
 * including when expired, two or more force a pick with no default — is
 * `./coverage-choice`, so it is testable without React Testing Library.
 */
export default function CoverageList({
  coverages,
  pick,
  onPick,
}: {
  coverages: EligibilityCoverage[]
  /** The resolved selection's index. `null` = nothing selected. */
  pick?: number | null
  /** Present = the agent may choose. Absent = read-only. */
  onPick?: (index: number) => void
}) {
  const { t } = useTranslation('eligibility')
  const rows = coverages ?? []

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('result.noCoverages')}</p>
  }

  return (
    <ul className="mt-2 flex flex-col gap-2">
      {rows.map((c, i) => {
        const selected = pick === i
        const facts = (
          <>
            <span className="font-medium">{c.memberId || t('coverage.noMemberId')}</span>
            <StatusBadge sev={c.inForce ? 'ok' : 'mute'}>
              {c.inForce ? t('coverage.inForce') : t('coverage.notInForce')}
            </StatusBadge>
            <span className="text-muted-foreground">
              {t('coverage.network', { network: c.network })}
            </span>
            <span className="text-muted-foreground">{t('coverage.plan', { plan: c.coveragePlan })}</span>
            <span className="text-muted-foreground">
              {t('coverage.class', { className: c.coverageClass })}
            </span>
            <span className="text-muted-foreground">
              {t('coverage.policyHolder', { policyHolder: c.policyHolderName })}
            </span>
          </>
        )

        // Keyed by position as well as identity: `Id` and `MemberId` are both
        // nullable on `EligibilityCoverageResponse`, and two blank-id coverages
        // under one member id would otherwise collide. It is also why the pick
        // token is the index and not the member id (`./coverage-choice`).
        const key = `${c.id}-${c.memberId}-${i}`
        const shell =
          'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border p-2 text-sm transition-colors ' +
          (selected ? 'border-primary bg-primary/5' : 'border-border/60')

        if (!onPick) {
          return (
            <li key={key} className={shell}>
              {facts}
            </li>
          )
        }
        return (
          <li key={key}>
            {/* A radio, not a select: "exactly one" is enforced by the control
                rather than by a message box, and the six facts stay readable
                beside the choice instead of collapsing into an option string. */}
            <label className={`${shell} cursor-pointer hover:bg-accent`}>
              <input
                type="radio"
                name="coverage"
                className="h-4 w-4 accent-primary"
                checked={selected}
                onChange={() => onPick(i)}
                aria-label={t('coverage.pickAria', {
                  memberId: c.memberId || t('coverage.noMemberId'),
                  plan: c.coveragePlan,
                })}
              />
              {facts}
            </label>
          </li>
        )
      })}
    </ul>
  )
}
