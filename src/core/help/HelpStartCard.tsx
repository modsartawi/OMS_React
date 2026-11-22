import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BookOpen, X } from 'lucide-react'
import { useSession } from '@/core/session'
import { buttonClass } from '@/core/ui/control-classes'
import IconButton from '@/core/ui/IconButton'
import { helpDir, useHelpLang } from './help-lang'
import { HELP_START_SLUG, helpHref } from './help-routes'
import { browserStorage, dismissStartCard, startCardShown } from './start-card'

/**
 * "New to Analytics? Start here" (oms 952, BackOffice spec 4182 §D, story 9): on Analytics Home, linking to the help's
 * `start` article (the tours join it once oms 955 ships). Each user can hide it (`./start-card`); when storage fails it
 * simply shows again. In core so the analytics feature draws it without importing the help feature.
 */
export default function HelpStartCard({ area }: { area: string }) {
  const lang = useHelpLang()
  const { t } = useTranslation('help', { lng: lang })
  const userId = useSession((s) => s.userId)
  const [shown, setShown] = useState(() => startCardShown(userId, browserStorage()))
  if (!shown) return null
  const dismiss = () => {
    dismissStartCard(userId, browserStorage())
    setShown(false)
  }
  return (
    <aside
      dir={helpDir(lang)}
      lang={lang}
      className="flex items-start gap-3 rounded-lg border border-primary-border/60 bg-primary-050 p-4"
      data-help-start-card
    >
      <BookOpen className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{t('startCard.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('startCard.body')}</p>
        <Link to={helpHref(area, HELP_START_SLUG)} className={`${buttonClass('secondary')} self-start`} data-help-start-link>
          {t('startCard.open')}
        </Link>
      </div>
      <IconButton label={t('startCard.dismiss')} onClick={dismiss} data-help-start-dismiss>
        <X className="size-4" aria-hidden />
      </IconButton>
    </aside>
  )
}
