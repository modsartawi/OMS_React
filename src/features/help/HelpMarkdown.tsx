import { Fragment, type ReactNode } from 'react'
import Markdown from 'markdown-to-jsx/react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ExternalLink, MonitorPlay } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import type { HelpLang } from '@/core/models/help'
import HelpImage from './HelpImage'
import { helpImageFile, helpLinkOf } from './help-links'

/**
 * An article's Markdown (oms 951, BackOffice spec 4182 §A, §D), through `markdown-to-jsx` (pinned exactly):
 *
 * - **No raw HTML**: `disableParsingRawHTML` leaves every tag in an article as inert text.
 * - `screen:/route` → an "Open this screen" button that navigates; `help:slug#anchor` → a link inside the help.
 * - `images/<name>.en.png` → the help image route's file in the help language; another host's image never loads.
 * - Headings get anchors (Arabic letters kept), so `help:slug#anchor` lands on them; code reads left to right.
 */
export default function HelpMarkdown({ area, markdown, lang }: { area: string; markdown: string; lang: HelpLang }) {
  return (
    <div className={HELP_PROSE}>
      <Markdown
        options={{
          disableParsingRawHTML: true,
          slugify: headingAnchor,
          wrapper: Fragment,
          overrides: {
            a: { component: HelpAnchor, props: { area, lang } },
            img: { component: HelpPicture, props: { area, lang } },
            code: InlineCode,
            pre: CodeBlock,
          },
        }}
      >
        {markdown}
      </Markdown>
    </div>
  )
}

/**
 * A heading's anchor: lower case, punctuation dropped, spaces to hyphens — letters of any script kept (the default
 * would empty an Arabic heading's id). 🚩 Assumed to match BO 4183's "stable anchors"; reconcile with the reader.
 */
export const headingAnchor = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')

// Article typography from tokens only (no colour literals), logical spacing only.
const HELP_PROSE = [
  'flex flex-col gap-3 text-sm leading-relaxed text-foreground',
  '[&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold',
  '[&_h2]:scroll-mt-4 [&_h3]:scroll-mt-4',
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

function HelpPicture({ src = '', alt = '', area, lang }: { src?: string; alt?: string; area: string; lang: HelpLang }) {
  const file = helpImageFile(src, lang)
  return file ? <HelpImage area={area} file={file} alt={alt} lang={lang} /> : null
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
