/**
 * The whole help on paper (oms 953, BackOffice spec 4182 §D "print route"). Pure: no React, no DOM.
 *
 * The contents' page numbers: Chromium has no `target-counter()`, so a CSS counter cannot print the page an article
 * lands on. The footer's number IS a CSS counter (`@page { @bottom-center { content: counter(page) } }`); the
 * contents' numbers are worked out here by paginating each article's blocks, measured on screen at the paper's exact
 * width, the way Chromium fragments them on paper (`pagesOfBlocks`): a block that must not split (a picture, a code
 * block, a table row) moves whole to the next page, a heading moves with the start of what follows it, and text breaks
 * between its lines. Every article starts a new page, so each one's first page is the pages before it, plus one.
 * Checked by reading the saved PDF (953's manual proof).
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

/**
 * One block of the paper as measured on screen, in px from the top of the run it belongs to (an article, the contents).
 * `line`: text that may break between its lines, each this tall; absent, the block must not be split (`break-inside:
 * avoid`). `keepWithNext`: never left alone at a page bottom (`break-after: avoid`, a heading; a table's header row, which
 * Chromium will not leave behind without a body row).
 */
export interface PrintBlock {
  top: number
  height: number
  line?: number
  keepWithNext?: boolean
}

/** Chromium's default `orphans`: a paragraph that cannot keep two lines at a page bottom starts the next page. */
const ORPHANS = 2

/** What of `b` must sit on the page it starts on: two lines of text, or all of a block that must not split. */
const firstPiece = (b: PrintBlock, pageHeight: number): number => Math.min(b.height, b.line === undefined ? pageHeight : ORPHANS * b.line)

/**
 * The pages a run of blocks takes from the top of a new page, never fewer than one — fragmented as Chromium prints it.
 * A block that does not fit what is left of a page starts the next one when it must not split (or its first two lines
 * do not fit, or it is a heading whose next block's start does not fit with it); the space left behind is lost. Text
 * runs on across pages, breaking at its last whole line; a block taller than a page is cut anyway.
 */
export function pagesOfBlocks(blocks: readonly PrintBlock[], pageHeight: number): number {
  let pageTop = 0
  let pages = 1
  const end = () => pageTop + pageHeight
  blocks.forEach((b, i) => {
    const bottom = b.top + b.height
    // A heading (or a table's header row) takes the start of the next block with it — through a chain of them.
    let last = i
    while (blocks[last].keepWithNext && last + 1 < blocks.length) last++
    const need = Math.max(last > i ? bottom : 0, blocks[last].top + firstPiece(blocks[last], pageHeight))
    if (need > end() && b.top > pageTop) {
      pageTop = b.top
      pages++
    }
    while (bottom > end()) {
      const cut = b.line ? b.top + Math.floor((end() - b.top) / b.line) * b.line : end()
      pageTop = cut > pageTop ? cut : end()
      pages++
    }
  })
  return pages
}

/**
 * The page each article starts on: the cover is page 1, the contents follows on its own page(s), and every article
 * starts a new page.
 */
export function contentsPageNumbers({ pageHeight, contents, articles }: { pageHeight: number; contents: readonly PrintBlock[]; articles: readonly (readonly PrintBlock[])[] }): number[] {
  let next = 1 + 1 + pagesOfBlocks(contents, pageHeight)
  return articles.map((blocks) => {
    const at = next
    next += pagesOfBlocks(blocks, pageHeight)
    return at
  })
}

/** The distinct "checked against" lines of an area's articles, in reading order (the cover prints each once). */
export const checkedAgainstOf = (articles: readonly { checkedAgainst: string }[]): string[] => [...new Set(articles.map((a) => a.checkedAgainst.trim()).filter(Boolean))]
