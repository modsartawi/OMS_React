import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CircleHelp } from 'lucide-react'
import IconButton from '@/core/ui/IconButton'
import { useHelpLang } from './help-lang'
import { hasPageHelp, usePageHelp } from './page-help'

/**
 * The "?" in an analytics page's header (oms 952, BackOffice spec 4182 §D), drawn by `ScreenGate` (decision 8): it opens
 * the page help drawer, which the shell mounts. Draws nothing off the analytics pages.
 */
export default function PageHelpButton() {
  const { pathname } = useLocation()
  const lang = useHelpLang()
  const { t } = useTranslation('help', { lng: lang })
  const open = usePageHelp((s) => s.open)
  const openHelp = usePageHelp((s) => s.openHelp)
  if (!hasPageHelp(pathname)) return null
  return (
    <IconButton label={t('drawer.open')} onClick={() => openHelp()} aria-haspopup="dialog" aria-expanded={open} data-page-help-button>
      <CircleHelp className="size-4" aria-hidden />
    </IconButton>
  )
}
