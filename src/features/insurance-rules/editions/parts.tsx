import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import type { EditionState } from './editions'

// Small pieces both Editions pages draw (ticket 613), in the `insurance-editions` namespace.

const STATE_SEV: Record<EditionState, Severity> = { pending: 'warn', live: 'ok', retired: 'mute' }

export function EditionStateBadge({ state }: { state: EditionState }) {
  const { t } = useTranslation('insurance-editions')
  return (
    <span data-edition-state={state}>
      <StatusBadge sev={STATE_SEV[state] ?? 'mute'}>{t(`state.${state}`, { defaultValue: state })}</StatusBadge>
    </span>
  )
}
