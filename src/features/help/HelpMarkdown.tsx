import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import Markdown from 'markdown-to-jsx/react'
import { Link, useNavigate } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { ExternalLink, MonitorPlay } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import type { HelpLang, HelpSection } from '@/core/models/help'
import HelpImage from './HelpImage'
import { anchorSlugifier, withoutHeadingAnchors } from './help-anchors'
import { helpImageFile, helpLinkOf } from './help-links'

/**
 * An article's Markdown (oms 951, BackOffice spec 4182 §A, §D), through `markdown-to-jsx` (pinned exactly):
 *
 * - **No raw HTML**: `disableParsingRawHTML` leaves every tag in an article as inert text.
 * - `screen:/route` → an "Open this screen" button that navigates; `help:slug#anchor` → a link inside the help.
 * - `images/<name>.en.png` → the help image route's file in the help language; another host's image never loads.
 * - Headings take the server's anchors (`./help-anchors`: an explicit `{#anchor}`, hidden from the reader, else the
 *   server's slug), so `help:slug#anchor` and the Copilot's help links land on them; code reads left to right.
 *
 * On paper (`print`, oms 953) nothing can be clicked: a `screen:` link prints as the screen's name (the link's words),
 * a `help:` link as "see <article title>", any other link as its words; each picture reports when it has settled.
 */
export default function HelpMarkdown({
  area,
  markdown,
  lang,
  sections,
  print,
}: {
  area: string
  markdown: string
  lang: HelpLang
  /** The server's section outline (`GET Help/{area}/{slug}`), whose anchors the headings take; worked out alike when absent. */
  sections?: readonly HelpSection[]
  print?: HelpPrintMode
}) {
  return (
    <div className={HELP_PROSE}>
      <Markdown
        options={{
          disableParsingRawHTML: true,
          // A fresh slugifier per draw: it hands each heading its anchor in document order.
          slugify: anchorSlugifier(markdown, sections),
          wrapper: Fragment,
          overrides: {
            a: print ? { component: PrintedAnchor, props: { lang, titles: print.titles } } : { component: HelpAnchor, props: { area, lang } },
            img: { component: HelpPicture, props: { area, lang, onSettled: print?.onImageSettled } },
            code: InlineCode,
            pre: CodeBlock,
          },
        }}
      >
        {withoutHeadingAnchors(markdown)}
      </Markdown>
    </div>
  )
}

// Article typography from tokens only (no colour literals), logical spacing only.
const HELP_PROSE = [
  'flex flex-col gap-3 text-sm leading-relaxed text-foreground',
  '[&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold',
  '[&_h2]:scroll-mt-4 [&_h3]:scroll-mt-4',
  // On paper: no heading left alone at a page bottom, no code block or table row cut in two.
  '[&_h1]:[break-after:avoid] [&_h2]:[break-after:avoid] [&_h3]:[break-after:avoid] [&_pre]:[break-inside:avoid] [&_tr]:[break-inside:avoid]',
  '[&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_li]:my-1',
  '[&_blockquote]:border-s-4 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground',
  '[&_table]:w-full [&_table]:text-start [&_th]:border-b [&_th]:border-border [&_th]:p-1.5 [&_th]:text-start [&_td]:border-b [&_td]:border-border [&_td]:p-1.5',
].join(' ')

function HelpAnchor({ href = '', children, area, lang }: { href?: string; children?: ReactNode; area: string; lang: HelpLang }) {
  const navigate = useNavigate()
  const { t } = useTranslation('help', { lng: lang })
  const link = helpLinkOf(href, area)
  switch (link.kind) {
    case 'screen':
      return (
        <Button variant="secondary" className="mx-1 inline-flex items-center gap-1.5 align-middle" onClick={() => navigate(link.to)} data-help-screen={link.to}>
          <MonitorPlay className="size-3.5" aria-hidden />
          {t('article.openScreen')}
        </Button>
      )
    case 'help':
      return (
        <Link to={link.to} className="font-medium text-primary underline underline-offset-2">
          {children}
        </Link>
      )
    case 'anchor':
      return (
        <a href={link.to} className="font-medium text-primary underline underline-offset-2">
          {children}
        </a>
      )
    case 'external':
      return (
        <a href={link.to} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2">
          {children}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      )
  }
}

/** The print mode: the area's article titles by slug (for "see <title>"), and a picture's settled report. */
export interface HelpPrintMode {
  titles: Readonly<Record<string, string>>
  onImageSettled?: (file: string) => void
}

const HELP = 'help:'

/** A link on paper: its words, or "see <article title>" for another article of the help. */
function PrintedAnchor({ href = '', children, lang, titles }: { href?: string; children?: ReactNode; lang: HelpLang; titles: Readonly<Record<string, string>> }) {
  const { t } = useTranslation('help', { lng: lang })
  const slug = href.startsWith(HELP) ? href.slice(HELP.length).split('#', 1)[0] : ''
  if (!slug) return <span data-help-print-link>{children}</span>
  const title = titles[slug] ?? textOf(children)
  // The title is free text in either script: one `<bdi>` around the whole of it (bidi rule).
  return (
    <span data-help-print-link={slug}>
      <Trans t={t} i18nKey="print.see" values={{ title }} components={{ t: <bdi /> }} />
    </span>
  )
}

/** The plain words of a link's children. */
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : isValidElement<{ children?: ReactNode }>(c) ? textOf(c.props.children) : ''))
    .join('')
}

function HelpPicture({ src = '', alt = '', area, lang, onSettled }: { src?: string; alt?: string; area: string; lang: HelpLang; onSettled?: (file: string) => void }) {
  const file = helpImageFile(src, lang)
  return file ? <HelpImage area={area} file={file} alt={alt} lang={lang} onSettled={onSettled} /> : null
}

function InlineCode({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <Ltr>
      <code className={`rounded bg-muted px-1 py-0.5 font-mono text-xs ${className ?? ''}`}>{children}</code>
    </Ltr>
  )
}

function CodeBlock({ children }: { children?: ReactNode }) {
  return (
    <pre dir="ltr" className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
      {children}
    </pre>
  )
}
