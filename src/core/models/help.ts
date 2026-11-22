/**
 * The help center's wire shapes (oms 951, BackOffice spec 4182 §B, ticket 4183).
 *
 * 🚩 GUESSED from spec 4182 pending BO 4183: the server is not built yet, so the field names below are read off the
 * spec's front-matter list (`slug, title, order, access, screens, checkedAgainst, questions`) and its "plus the
 * area's draft flag". Reconcile here, in this one file, once 4183 ships.
 *
 * - `GET help/{area}?lang=en|ar` → {@link HelpContents}
 * - `GET help/{area}/{slug}?lang=` → {@link HelpArticle} (404 for an unknown area or slug)
 * - `GET help/{area}/images/{file}` → the image bytes (404 when missing)
 *
 * All three need a login and no grant. An unknown `lang` falls back to `en` on the server.
 */

/** The languages an article is written in — separately, not translated word for word. */
export type HelpLang = 'en' | 'ar'

/** The access an article's features need (the four Analytics levels). */
export const HELP_ACCESS = ['viewer', 'author', 'curator', 'sql'] as const
export type HelpAccess = (typeof HELP_ACCESS)[number]

/** One article's front matter, as the table of contents lists it. */
export interface HelpArticleMeta {
  /** The same in both languages: `start`, `boards`, `whats-new`… */
  slug: string
  title: string
  order: number
  access: HelpAccess
  /** The oms-react routes the article covers (`/analytics/boards`, `/analytics/board/:id`). */
  screens: string[]
  /** Two or three sample how-to questions in the article's language. */
  questions: string[]
  /** The oms-react commit, SIS.Api version and analytics image version the article was checked against. */
  checkedAgainst: string
}

/** An area's table of contents: its articles (the server sends them in order) and whether the area is still draft. */
export interface HelpContents {
  draft: boolean
  articles: HelpArticleMeta[]
}

/** One article: its front matter and its Markdown, links left for the client to render. */
export interface HelpArticle extends HelpArticleMeta {
  markdown: string
}
