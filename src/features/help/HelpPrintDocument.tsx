import { useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { formatDay } from '@/core/charts/format'
import { helpDir } from '@/core/help/help-lang'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { HelpAccess, HelpArticle, HelpContents, HelpLang } from '@/core/models/help'
import { helpAccessLabel } from './HelpAccessBadge'
import HelpMarkdown, { type HelpPrintMode } from './HelpMarkdown'
import { inReadingOrder } from './help-contents'
import { checkedAgainstOf } from './help-print'

/**
 * The whole help on paper (oms 953, BackOffice spec 4182 §D), in one language and its direction: the cover (title,
 * language, "checked against", print date, a Draft watermark while the area is draft), the contents (every article,
 * its access badge and the page it starts on), then every article in reading order, each from a new page.
 *
 * Presentational: the print page fetches, measures the page numbers (`pageNumbers`, null until laid out) and listens
 * for the pictures (`onImageSettled`).
 */
export default function HelpPrintDocument({
  area,
  lang,
  contents,
  articles,
  pageNumbers,
  printedOn,
  onImageSettled,
}: {
  area: string
  lang: HelpLang
  contents: HelpContents
  /** The articles' bodies, any order; an article the contents lists without a body here is not printed yet. */
  articles: readonly HelpArticle[]
  pageNumbers: readonly number[] | null
  /** The print date, `yyyy-mm-dd`. */
  printedOn: string
  onImageSettled?: (file: string) => void
}) {
  const { t } = useTranslation('help', { lng: lang })
  const ordered = useMemo(() => inReadingOrder(contents.articles), [contents.articles])
  const bodies = useMemo(() => new Map(articles.map((a) => [a.slug, a])), [articles])
  const print: HelpPrintMode = useMemo(() => ({ titles: Object.fromEntries(ordered.map((a) => [a.slug, a.title])), onImageSettled }), [ordered, onImageSettled])
  const checked = checkedAgainstOf(ordered)

  return (
    <div dir={helpDir(lang)} lang={lang} className="flex flex-col text-sm" data-help-print={area}>
      <section className="@container relative flex h-[240mm] flex-col justify-center gap-4 overflow-hidden" data-help-print-cover>
        {contents.draft && (
          // A watermark is a picture, not reading order: one fixed slant whatever the direction. It is sized to the
          // cover's width (`cqi`), on one line, and centred on a grid, so the slanted word stays inside the page in
          // either language and whatever the font.
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center" data-help-print-draft>
            <span className="-rotate-30 whitespace-nowrap text-[length:min(8rem,16cqi)] font-bold leading-none uppercase text-muted-foreground/20">{t('draft.title')}</span>
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{t(`areas.${area}.guide`)}</h1>
        <p className="text-base" data-help-print-language>
          {t('print.language', { name: t(`print.languages.${lang}`) })}
        </p>
        {checked.length > 0 && (
          <div className="flex flex-col gap-1 text-muted-foreground" data-help-print-checked>
            <span>{t('print.checkedAgainst')}</span>
            {checked.map((c) => (
              // Commit and versions are machine values: one isolate around the whole line (bidi rule).
              <Ltr key={c}>{c}</Ltr>
            ))}
          </div>
        )}
        <p className="text-muted-foreground" data-help-print-date>
          <Trans t={t} i18nKey="print.printedOn" values={{ date: formatDay(printedOn, lang) }} components={{ v: <Ltr /> }} />
        </p>
      </section>

      <section className="flex flex-col gap-3 [break-before:page]" data-help-print-contents>
        <h2 className="text-xl font-semibold tracking-tight">{t('contents.label')}</h2>
        <ol className="flex flex-col gap-2">
          {ordered.map((a, i) => (
            <li key={a.slug} className="flex items-baseline gap-2 [break-inside:avoid]" data-help-print-entry={a.slug}>
              <bdi className="font-medium">{a.title}</bdi>
              <AccessBadges access={a.access} lang={lang} />
              <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-border" />
              {pageNumbers?.[i] !== undefined && (
                <span className="tabular-nums" data-help-print-page={pageNumbers[i]}>
                  <Ltr>{pageNumbers[i]}</Ltr>
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {ordered.map((meta) => {
        const a = bodies.get(meta.slug)
        return (
          <section key={meta.slug} className="flex flex-col gap-3 [break-before:page]" data-help-print-article={meta.slug}>
            <header className="flex flex-col gap-2 border-b border-border pb-3 [break-after:avoid]">
              <h2 className="text-xl font-semibold tracking-tight">
                <bdi>{meta.title}</bdi>
              </h2>
              <span className="flex flex-wrap gap-2">
                <AccessBadges access={meta.access} lang={lang} />
              </span>
            </header>
            {a && <HelpMarkdown area={area} markdown={a.markdown} sections={a.sections} lang={lang} print={print} />}
          </section>
        )
      })}
    </div>
  )
}

/** The levels an article needs, one badge each — on paper, for any reader, so no "you have / ask" sentence. */
function AccessBadges({ access, lang }: { access: readonly HelpAccess[]; lang: HelpLang }) {
  const { t } = useTranslation('help', { lng: lang })
  return access.map((level) => (
    <span key={level} data-help-access={level} className="contents">
      <StatusBadge sev="mute">{helpAccessLabel(t, level)}</StatusBadge>
    </span>
  ))
}
