import { useTranslation } from 'react-i18next'
import { canOpenDeposits } from './api'
import ScreenGate from './ScreenGate'

/**
 * Deposits (`/collection/deposits`) — the accountant's screen.
 *
 * A shell for now (ticket 253); [256](../../../../.issues/256-deposits-shows-its-lines-and-balances.md)
 * adds the grid, the in-place claimed-ACR lines and the per-collector balances.
 */
export default function DepositsPage() {
  const { t } = useTranslation('collection')
  return (
    <ScreenGate can={canOpenDeposits} title={t('deposits.title')} subtitle={t('deposits.subtitle')} />
  )
}
