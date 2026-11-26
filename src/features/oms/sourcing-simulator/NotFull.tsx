import { useTranslation } from 'react-i18next'

/** What a solver diagram shows when the reply's level does not carry its part (ticket 966: the parts are the full level's). */
export default function NotFull() {
  const { t } = useTranslation('sourcing-simulator')
  return (
    <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-solver-not-full="">
      {t('solver.notFull')}
    </p>
  )
}
