import { useTranslation } from 'react-i18next'

/**
 * The "To open" tab (ticket 546 fills it): unopened orders across stores, grouped by store
 * (`GET PrescriptionSessionWeb/ToOpen?store`). A placeholder until then — 546 replaces this file's
 * body and owns the `toOpen.*` keys; the page only mounts it while `tab=toOpen`.
 */
export default function ToOpenTab() {
  const { t } = useTranslation('prescription-sessions')
  return (
    <p className="rounded-lg border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground" data-ps-tab-placeholder="toOpen">
      {t('toOpen.placeholder')}
    </p>
  )
}
