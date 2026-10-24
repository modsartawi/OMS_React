import { useTranslation } from 'react-i18next'

/**
 * The "Ended" tab (ticket 547 fills it): ended sessions by date with their after-close lines
 * (`GET PrescriptionSessionWeb/Ended?from&to&store&state`). A placeholder until then — 547 replaces
 * this file's body and owns the `ended.*` keys; the page only mounts it while `tab=ended`.
 */
export default function EndedTab() {
  const { t } = useTranslation('prescription-sessions')
  return (
    <p className="rounded-lg border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground" data-ps-tab-placeholder="ended">
      {t('ended.placeholder')}
    </p>
  )
}
