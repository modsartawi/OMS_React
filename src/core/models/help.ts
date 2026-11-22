/**
 * The help center's wire shapes (oms 951, BackOffice spec 4182 §B).
 *
 * Reconciled with BackOffice pricing2 @ 98f9a5ad9 (4183/4184/4188): `SIS.Api/Endpoints/Help/HelpWebEndpoints.cs`
 * (the doors and reply records) and `Sartawi.Retail.Data/Modules/Help/HelpModels.cs` (`HelpArticleInfo`). JSON is
 * ASP.NET's web default, camelCase.
 *
 * - `GET Help/{area}?lang=en|ar` → {@link HelpContentsReply}, read as {@link HelpContents}
 * - `GET Help/{area}/{slug}?lang=` → {@link HelpArticleReply} (404 for an unknown area or slug), read as {@link HelpArticle}
 * - `GET Help/{area}/images/{file}` → the image bytes with their content type (404 when missing)
 *
 * All three need a login and no grant. An unknown `lang` reads as `en` on the server.
 */

/** The languages an article is written in — separately, not translated word for word. */
export type HelpLang = 'en' | 'ar'

/** The access levels an article's features need (the four Analytics grants), lowest first. */
export const HELP_ACCESS = ['viewer', 'author', 'curator', 'sql'] as const
export type HelpAccess = (typeof HELP_ACCESS)[number]

/** One article's front matter (`HelpArticleInfo`), as the table of contents lists it. */
export interface HelpArticleMeta {
  /** The same in both languages: `start`, `boards`, `whats-new`… */
  slug: string
  title: string
  order: number
  /** One or more levels, read lowest first and once each (the server may send a level the app does not know). */
  access: HelpAccess[]
  /** The oms-react routes the article covers — route patterns (`/analytics/boards`, `/analytics/board/:id`). */
  screens: string[]
  /** Two or three sample how-to questions in the article's language. */
  questions: string[]
  /** The oms-react commit, SIS.Api version and analytics image version the article was checked against, as one line. */
  checkedAgainst: string
}

/** A guided tour's step (`HelpTourStepInfo`, 4188): the `data-tour` target on `route` (a route pattern), its words. */
export interface HelpTourStep {
  id: string
  target: string
  route: string
  title: string
  /** The step's Markdown. */
  body: string
  /** A named app-state check that ticks the step; null when the reader moves on with Next. */
  ticksWhen: string | null
}

/** A guided tour in the table of contents (`HelpTourInfo`, 4188). oms 955 walks it; nothing renders it yet. */
export interface HelpTour {
  id: string
  title: string
  access: HelpAccess[]
  steps: HelpTourStep[]
}

/** `GET Help/{area}` as sent (`HelpContents`). */
export interface HelpContentsReply {
  area: string
  language: HelpLang
  draft: boolean
  articles: HelpArticleMeta[]
  tours: HelpTour[]
}

/** An area's table of contents as the client reads it: its articles (in order), its tours and the draft flag. */
export interface HelpContents {
  draft: boolean
  articles: HelpArticleMeta[]
  tours: HelpTour[]
}

/**
 * One section's place in an article (`HelpSectionOutline`): the intro (anchor `''`, level 1) then every `##` / `###`
 * heading — its `{#anchor}` when written, else one made from its words — in order.
 */
export interface HelpSection {
  anchor: string
  heading: string
  level: number
}

/** `GET Help/{area}/{slug}` as sent (`HelpArticleReply`): the front matter nested under `article`. */
export interface HelpArticleReply {
  area: string
  language: HelpLang
  draft: boolean
  article: HelpArticleMeta
  /** The body after the front matter, as written: links left for the client, headings keeping their `{#anchor}`. */
  markdown: string
  sections: HelpSection[]
}

/** One article as the client reads it: its front matter, its Markdown and its section outline, side by side. */
export interface HelpArticle extends HelpArticleMeta {
  markdown: string
  sections: HelpSection[]
}
