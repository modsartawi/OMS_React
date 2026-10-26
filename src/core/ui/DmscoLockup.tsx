import { useTranslation } from 'react-i18next'
import lockupUrl from '@/assets/dmsco/dmsco-lockup-on-dark.svg'
import symbolUrl from '@/assets/dmsco/dmsco-symbol-on-dark.svg'

/**
 * The DMSCO brand lockup for the navy shell (spec 590; map 580's 587, ticket 592): the
 * white lockup, a hairline divider, then the "BackOffice" wordmark — or, `collapsed`,
 * the dotted-D symbol alone, cropped from the same artwork (viewBox `155 0 107 140` of
 * the 262×140 lockup). White artwork: it sits on the rail's navy, never on a light card.
 *
 * Its name is `common:brandLockup`. `data-brand-lockup` carries the state for the drives.
 */
export default function DmscoLockup({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation()
  if (collapsed)
    return (
      <span data-brand-lockup="collapsed" className="flex">
        <img src={symbolUrl} alt={t('brandLockup')} width={22} height={29} />
      </span>
    )
  return (
    <span data-brand-lockup="expanded" className="flex min-w-0 items-center gap-2.5 py-1">
      <img src={lockupUrl} alt={t('brandLockup')} width={77} height={41} className="shrink-0" />
      <span data-brand-lockup-divider aria-hidden className="h-7 w-px shrink-0 bg-rail-accent-foreground/20" />
      <span className="truncate text-sm font-semibold tracking-tight text-rail-accent-foreground">{t('brandName')}</span>
    </span>
  )
}
