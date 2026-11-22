/**
 * The help center's search (oms 951, BackOffice spec 4182 §B): client-side, over an area's table of contents plus each
 * article's text — an area holds about fifteen articles, so no index. Pure: no React, no i18n.
 *
 * An article matches when every word of the query is found in its title, its questions or its body. Text is folded
 * the same way on both sides: lower case, and for Arabic without diacritics (tashkeel, the dagger alef, tatweel), with
 * أ إ آ ٱ read as ا and ة read as ه — so a word typed bare finds one written with its marks, and the reverse.
 */
import type { HelpArticleMeta } from '@/core/models/help'

// Harakat, tanween, shadda, sukun and the extended marks (U+064B–U+065F), the dagger alef (U+0670), tatweel (U+0640).
const ARABIC_MARKS = /[ً-ٰٟـ]/g
const ALEF_VARIANTS = /[أإآٱ]/g // أ إ آ ٱ
const TAA_MARBUTA = /ة/g // ة

/** Text as search compares it. */
export function foldForSearch(text: string): string {
  return text.toLowerCase().replace(ARABIC_MARKS, '').replace(ALEF_VARIANTS, 'ا').replace(TAA_MARBUTA, 'ه')
}

/**
 * An article's Markdown as the words a reader sees: link and image targets dropped (their labels kept), and the
 * Markdown marks (`#`, `*`, `_`, `` ` ``, `>`, `|`, brackets) turned to spaces.
 */
export function markdownWords(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?\n---\s*\n/, ' ') // a front-matter block, should one ride along
    .replace(/\]\([^)]*\)/g, ' ') // `](target)` of a link or an image
    .replace(/[#*_`>|[\]!~-]+/g, ' ')
}

/**
 * The articles that match `query`, in their given order. `bodies` holds each article's Markdown by slug — an article
 * whose body is not fetched yet is searched by its title and questions alone.
 */
export function searchArticles(articles: readonly HelpArticleMeta[], bodies: Readonly<Record<string, string | undefined>>, query: string): HelpArticleMeta[] {
  // The query drops the same marks the body does, so `drill-down` finds a body's `drill-down` (review 4182 #5).
  const words = foldForSearch(markdownWords(query)).split(/\s+/).filter(Boolean)
  if (query.trim() === '') return [...articles]
  // A query of marks alone (`**`) names no word a reader sees: nothing matches it.
  if (words.length === 0) return []
  return articles.filter((a) => {
    const body = bodies[a.slug]
    const hay = foldForSearch([a.title, ...a.questions, body ? markdownWords(body) : ''].join('\n'))
    return words.every((w) => hay.includes(w))
  })
}
