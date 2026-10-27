import { useTranslation } from 'react-i18next'
import type { CoverageEffect } from '@/core/insurance-rules/coverage-model'
import StatusBadge from '@/core/ui/StatusBadge'
import { payerMark } from './ruleset-edit'

// The Insurers / Categories / Coverage screens' own piece (oms 617): the payer
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
