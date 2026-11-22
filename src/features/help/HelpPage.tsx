import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Printer } from 'lucide-react'
import { ApiError, apiErrorMessage } from '@/core/api'
import { helpArticleQuery, useHelpContents } from '@/core/help/help-api'
import { helpDir, useHelpLang } from '@/core/help/help-lang'
import { HELP_START_SLUG, helpHref } from '@/core/help/help-routes'
import { usePermissions } from '@/core/permissions'
import { buttonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import type { HelpArticleMeta, HelpLang } from '@/core/models/help'
import HelpAccessBadge from './HelpAccessBadge'
import HelpContentsRail from './HelpContentsRail'
import HelpDraftBanner from './HelpDraftBanner'
import HelpMarkdown from './HelpMarkdown'
import { neighbours } from './help-contents'
import { helpPrintHref } from './help-print'
import { searchArticles } from './help-search'

/**
 * The help center (oms 951, BackOffice spec 4182 §D) at `/<area>/help` and `/<area>/help/:slug` — `/analytics/help`
 * for the analytics area, opening `start`. A login only: the articles hold no business data, and each one stays
 * readable whatever the reader holds; its badge says whether they have its access or whom to ask.
 *
 * The articles live in SIS.Api (ADR 0143); this page only reads them, in the help language (`useHelpLang`: Arabic
 * when the app reads Arabic or boots right-to-left). The page — rail, search, article — takes that language's
 * direction, so an Arabic article reads right to left inside the English shell.
 *
 * 🚩 Stubbed contract (BO 4183 not built): the wire shapes are guessed in `@/core/models/help`.
 */
export default function HelpPage({ area }: { area: string }) {
  const lang = useHelpLang()
  const { t } = useTranslation('help', { lng: lang })
  const slug = useParams().slug ?? HELP_START_SLUG
  const permissions = usePermissions()
  const contents = useHelpContents(area, lang)
  const [query, setQuery] = useState('')

  const articles = contents.data?.articles ?? []
  const searching = query.trim() !== ''
  // Search reads every article's body; fetched only once someone searches (an area has about fifteen).
  const bodies = useQueries({
    queries: (searching ? articles : []).map((a) => helpArticleQuery(area, a.slug, lang)),
    combine: (reads) => Object.fromEntries(reads.flatMap((r) => (r.data ? [[r.data.slug, r.data.markdown]] : []))) as Record<string, string>,
  })
  const found = useMemo(() => searchArticles(articles, bodies, query), [articles, bodies, query])

  return (
    <section dir={helpDir(lang)} lang={lang} className="flex h-full w-full flex-col gap-4" data-help-page={area}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t(`areas.${area}.title`)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(`areas.${area}.subtitle`)}</p>
        </div>
        {/* The whole help on paper (oms 953), in the help language, in a new tab. */}
        <Link to={helpPrintHref(area, lang)} target="_blank" rel="noopener" className={buttonClass('secondary', 'inline-flex items-center gap-1.5')} data-help-print-open>
          <Printer className="size-3.5" aria-hidden />
          {t('print.open')}
        </Link>
      </header>
      {contents.data && <HelpDraftBanner draft={contents.data.draft} lang={lang} />}
      {contents.isError ? (
        <ErrorBanner title={t('state.contentsFailed')} message={apiErrorMessage(contents.error, t('state.contentsFailed'))} className="px-3 py-2" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
          <aside className="flex w-full shrink-0 flex-col gap-3 md:w-64">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.label')}
              wrapperClassName="w-full"
              data-help-search
            />
            {contents.isPending ? (
              <p className="text-sm text-muted-foreground">{t('state.loading')}</p>
            ) : found.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-help-search-empty>
                {t('search.empty')}
              </p>
            ) : (
              <HelpContentsRail area={area} articles={found} activeSlug={slug} permissions={permissions} lang={lang} />
            )}
          </aside>
          <HelpArticleView area={area} slug={slug} lang={lang} articles={articles} />
        </div>
      )}
    </section>
  )
}

function HelpArticleView({ area, slug, lang, articles }: { area: string; slug: string; lang: HelpLang; articles: readonly HelpArticleMeta[] }) {
  const { t } = useTranslation('help', { lng: lang })
  const permissions = usePermissions()
  const article = useQuery({ ...helpArticleQuery(area, slug, lang), retry: (n, err) => !(err instanceof ApiError && err.statusCode === 404) && n < 2 })
  const { hash } = useLocation()
  const { previous, next } = neighbours(articles, slug)

  // A `help:slug#anchor` link lands on its heading once the article has drawn.
  useEffect(() => {
    if (!article.data || !hash) return
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' })
  }, [article.data, hash])

  if (article.isPending) return <p className="flex-1 text-sm text-muted-foreground">{t('state.loading')}</p>
  if (article.isError) {
    const missing = article.error instanceof ApiError && article.error.statusCode === 404
    return (
      <div className="flex-1">
        {missing ? (
          <p className="text-sm text-muted-foreground" data-help-not-found>
            {t('state.notFound')}
          </p>
        ) : (
          <ErrorBanner title={t('state.articleFailed')} message={apiErrorMessage(article.error, t('state.articleFailed'))} className="px-3 py-2" />
        )}
      </div>
    )
  }

  const a = article.data
  return (
    <article className="flex min-w-0 max-w-3xl flex-1 flex-col gap-4" data-help-article={a.slug}>
      <header className="flex flex-col gap-2 border-b border-border pb-3">
        <h2 className="text-xl font-semibold tracking-tight">
          <bdi>{a.title}</bdi>
        </h2>
        <HelpAccessBadge access={a.access} permissions={permissions} lang={lang} />
      </header>
      <HelpMarkdown area={area} markdown={a.markdown} lang={lang} />
      {a.checkedAgainst && (
        <p className="text-xs text-muted-foreground" data-help-checked-against>
          {/* The commit and versions are machine values: one isolate around the whole value (bidi rule). */}
          <Trans t={t} i18nKey="article.checkedAgainst" values={{ version: a.checkedAgainst }} components={{ v: <bdi dir="ltr" /> }} />
        </p>
      )}
      <nav className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
        {previous ? (
          <Link to={helpHref(area, previous.slug)} className="inline-flex items-center gap-1.5 text-primary hover:underline" rel="prev">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            <span className="text-muted-foreground">{t('article.previous')}</span>
            <bdi>{previous.title}</bdi>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={helpHref(area, next.slug)} className="inline-flex items-center gap-1.5 text-primary hover:underline" rel="next">
            <span className="text-muted-foreground">{t('article.next')}</span>
            <bdi>{next.title}</bdi>
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        )}
      </nav>
    </article>
  )
}
