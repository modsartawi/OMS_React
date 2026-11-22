/**
 * The whole help on paper (oms 953, BackOffice spec 4182 §D "print route"). Pure: no React, no DOM.
 *
 * The contents' page numbers: Chromium has no `target-counter()`, so a CSS counter cannot print the page an article
 * lands on. The footer's number IS a CSS counter (`@page { @bottom-center { content: counter(page) } }`); the
 * contents' numbers are worked out here from the blocks' heights, measured on screen at the paper's exact width
 * (every article starts a new page, so each one's first page is the pages before it, plus one). A picture or a heading
 * pushed to the next page can still move an article by a page — checked by reading the saved PDF (953's manual proof).
 */
import type { HelpArticle, HelpLang } from '@/core/models/help'
import { helpImageFile } from './help-links'

/** The print route of an area's help, in one language: `/analytics/print/help?lang=ar`. */
export const helpPrintHref = (area: string, lang: HelpLang): string => `/${area}/print/help?lang=${lang}`

/** The print language from the query string: `ar` or, for anything else, `en`. */
export const helpPrintLang = (search: URLSearchParams): HelpLang => (search.get('lang') === 'ar' ? 'ar' : 'en')

const PICTURE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g

/**
 * The Markdown with what the renderer draws as text, not pictures, blanked: fenced blocks (``` and ~~~), indented code
 * blocks, inline code spans and an escaped `\![`. Image syntax in there is shown, never loaded — waiting on it would
 * hold the print forever (review 4182 #4).
 */
function withoutCode(markdown: string): string {
  const kept: string[] = []
  let fence: string | null = null // the opening run (``` or ~~~) while inside a fenced block
  let inIndented = false
  let previousBlank = true
  for (const row of markdown.split(/\r?\n/)) {
    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(row)?.[1]
    if (fence !== null) {
      // A fence closes on a run of the same character, at least as long, with nothing after it.
      if (opener && opener[0] === fence[0] && opener.length >= fence.length && row.trim() === opener) fence = null
      kept.push('')
      continue
    }
    if (opener) {
      fence = opener
      kept.push('')
      continue
    }
    const blank = row.trim() === ''
    // An indented code block starts after a blank line (it cannot interrupt a paragraph) and runs while indented.
    inIndented = !blank && /^(?: {4}|\t)/.test(row) && (inIndented || previousBlank)
    kept.push(inIndented ? '' : row)
    previousBlank = blank
  }
  return kept
    .join('\n')
    .replace(/(`+)[\s\S]*?\1/g, ' ') // inline code spans
    .replace(/\\!/g, ' ') // an escaped `\![`
}

/** The help pictures an article's Markdown names, as the print language's files, once each, in order. */
export function articleImages(markdown: string, lang: HelpLang): string[] {
  const files = [...withoutCode(markdown).matchAll(PICTURE)].flatMap((m) => {
    const file = helpImageFile(m[1], lang)
    return file ? [file] : []
  })
  return [...new Set(files)]
}

/**
 * Ready to print: every article has arrived (or failed: `null`), every picture they name has settled (loaded or
 * failed), and the contents' page numbers are laid out. `undefined` is an article still on its way.
 */
export function printReady({ articles, settled, lang, paged }: { articles: readonly (HelpArticle | null | undefined)[]; settled: ReadonlySet<string>; lang: HelpLang; paged: boolean }): boolean {
  if (!paged) return false
  for (const a of articles) {
    if (a === undefined) return false
    if (a === null) continue
    for (const file of articleImages(a.markdown, lang)) if (!settled.has(file)) return false
  }
  return true
}

/** The pages a block of `height` takes, never fewer than one. */
const pagesOf = (height: number, pageHeight: number): number => Math.max(1, Math.ceil(height / pageHeight))

/**
 * The page each article starts on: the cover is page 1, the contents follows on its own page(s), and every article
 * starts a new page.
 */
export function contentsPageNumbers({ pageHeight, contentsHeight, articleHeights }: { pageHeight: number; contentsHeight: number; articleHeights: readonly number[] }): number[] {
  let next = 1 + 1 + pagesOf(contentsHeight, pageHeight)
  return articleHeights.map((h) => {
    const at = next
    next += pagesOf(h, pageHeight)
    return at
  })
}

/** The distinct "checked against" lines of an area's articles, in reading order (the cover prints each once). */
export const checkedAgainstOf = (articles: readonly { checkedAgainst: string }[]): string[] => [...new Set(articles.map((a) => a.checkedAgainst.trim()).filter(Boolean))]
