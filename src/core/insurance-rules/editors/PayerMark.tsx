// core/insurance-rules/editors (oms 676): the guard, coverage and category block editors, shared by the guards and
// coverage features and the rule playground. They still read the `insurance-guards` / `insurance-coverage` namespaces —
// a namespace is a string, not an import, so the boundary holds; the coverage feature's and core/insurance-rules' i18n-keys tests cover them.
import { useTranslation } from 'react-i18next'
import type { CoverageEffect } from '@/core/insurance-rules/coverage-model'
import StatusBadge from '@/core/ui/StatusBadge'
import { payerMark } from './coverage-edit'

// The payer mark (oms 617), moved here from the coverage feature's parts.tsx with the editors (676): the payer
// mark every coverage value carries. The controls, denied card and loading line are the area's (core/insurance-rules).



/** "Fills what the payer left out" or "Overrides the payer" — shown on every coverage value (3146). */
export function PayerMark({ effect }: { effect: Pick<CoverageEffect, 'overridesPayer'> }) {
  const { t } = useTranslation('insurance-coverage')
  const mark = payerMark(effect)
  return (
    <span data-payer-mark={mark} title={t(`payerMark.${mark}Hint`)}>
      <StatusBadge sev={mark === 'overrides' ? 'warn' : 'mute'}>{t(`payerMark.${mark}`)}</StatusBadge>
    </span>
  )
}
