import { useTranslation } from 'react-i18next'
import { FileX } from 'lucide-react'

import { ToggleChip } from './GridStates'
import type { NoSlipToggle } from './slips'

/**
 * The "No slip" toggle both slip-counted toolbars draw (ticket 320): the store
 * days holding exactly 0 slips. A CLIENT filter over the rows already here, so it
 * applies at once and sends nothing; the toolbar's Reset turns it off. Draws
 * nothing when `toggle` is absent — the session may not see slips.
 */
export default function NoSlipChip({ toggle }: { toggle: NoSlipToggle | undefined }) {
  const { t } = useTranslation('collection')
  if (!toggle) return null
  return (
    <ToggleChip
      icon={<FileX className="h-3.5 w-3.5" aria-hidden />}
      label={t('slips.noSlip')}
      pressed={toggle.pressed}
      onToggle={toggle.onToggle}
    />
  )
}
