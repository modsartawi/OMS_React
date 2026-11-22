import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { articleForRoute } from '@/core/help/article-for-route'
import { helpArticleQuery, useHelpContents } from '@/core/help/help-api'
import { helpDir, useHelpLang } from '@/core/help/help-lang'
import { helpHref } from '@/core/help/help-routes'
import { helpDrawerSide, usePageHelp } from '@/core/help/page-help'
import type { HelpLang } from '@/core/models/help'
import { buttonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { SHEET_BODY } from '@/core/ui/sheet-table'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import HelpDraftBanner from './HelpDraftBanner'
import HelpMarkdown from './HelpMarkdown'

/** The help area every page drawer reads today: the analytics pages are the only ones with a "?". */
const AREA = 'analytics'

/**
 * The page help drawer (oms 952, BackOffice spec 4182 §D), mounted by the shell while `@/core/help/page-help` is open:
 * the article covering the current route (`articleForRoute`, else `start`) in the help language, beside the work, with
 * "Open full article". The shell closes it when the route changes.
 */
export default function HelpDrawer() {
  const lang = useHelpLang()
  const { pathname } = useLocation()
  const close = usePageHelp((s) => s.close)
  const pressKey = usePageHelp((s) => s.pressKey)
  return <HelpDrawerSheet area={AREA} pathname={pathname} lang={lang} onClose={close} onKey={pressKey} />
}

/**
 * The drawer itself: a modal `SideSheet` taking the help language's `dir`, so its inline-end docking puts it on the
 * right in English and on the left in Arabic. Escape closes it (the dialog's cancel, and `onKey`).
 */
export function HelpDrawerSheet({ area, pathname, lang, onClose, onKey }: { area: string; pathname: string; lang: HelpLang; onClose: () => void; onKey?: (key: string) => void }) {
  const { t } = useTranslation('help', { lng: lang })
  const titleId = useId()
  const contents = useHelpContents(area, lang)
  const slug = articleForRoute(contents.data?.articles, pathname)
  const article = useQuery({ ...helpArticleQuery(area, slug, lang), enabled: contents.isSuccess || contents.isError })
  const title = article.data?.title ?? contents.data?.articles.find((a) => a.slug === slug)?.title

  return (
    <SideSheet
      onClose={onClose}
      width="w-[32rem]"
      dir={helpDir(lang)}
      lang={lang}
      aria-labelledby={titleId}
      onKeyDown={(e) => onKey?.(e.key)}
      data-help-drawer-side={helpDrawerSide(lang)}
      data-help-drawer-article={slug}
    >
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('drawer.eyebrow')}
        title={title ? <bdi>{title}</bdi> : t('state.loading')}
        closeLabel={t('drawer.close')}
        onClose={onClose}
      />
      <div className={SHEET_BODY}>
        {contents.data && <HelpDraftBanner draft={contents.data.draft} lang={lang} />}
        {article.isError ? (
          <ErrorBanner title={t('state.articleFailed')} message={apiErrorMessage(article.error, t('state.articleFailed'))} className="px-3 py-2" />
        ) : article.data ? (
          <HelpMarkdown area={area} markdown={article.data.markdown} lang={lang} />
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            {t('state.loading')}
          </p>
        )}
        <Link to={helpHref(area, slug)} onClick={onClose} className={`${buttonClass('secondary')} self-start`} data-help-drawer-full>
          <ExternalLink className="size-4" aria-hidden />
          {t('drawer.openFull')}
        </Link>
      </div>
    </SideSheet>
  )
}
