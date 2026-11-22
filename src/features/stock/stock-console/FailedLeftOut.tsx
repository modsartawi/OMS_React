import { useTranslation } from 'react-i18next'

/** The line above a Takes list searched by item or batch (oms 942/943): failed calls carry no item, so they are left out. */
export default function FailedLeftOut() {
  const { t } = useTranslation('stock-console')
  return (
    <p className="text-xs text-muted-foreground" data-failed-left-out="">
      {t('takes.failedLeftOut')}
    </p>
  )
}
