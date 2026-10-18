import { useTranslation } from 'react-i18next'
import type { RuleUploadState } from '@/core/models/rule-upload'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { STATE_SEV, isKnownState } from './review'

/** An upload's state: a listed one in our words, an unlisted one as HQ sent it. */
export default function UploadStateBadge({ state }: { state: RuleUploadState }) {
  const { t } = useTranslation('campaign-uploads')
  return (
    <span data-upload-state={state}>
      {isKnownState(state) ? (
        <StatusBadge sev={STATE_SEV[state]}>{t(`state.${state}`)}</StatusBadge>
      ) : (
        <StatusBadge sev="mute">
          <Ltr>{state}</Ltr>
        </StatusBadge>
      )}
    </span>
  )
}
