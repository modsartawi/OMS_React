/**
 * The help endpoint's client (oms 951, BackOffice 4183) and its TanStack Query options — in core so the help page, the
 * drawer and print page (`features/help`), and the copilot's "How do I…?" row (952) share one cache.
 *
 * 🚩 Stubbed contract: the wire shapes are guessed in `@/core/models/help` pending BO 4183.
 */
import { useQuery } from '@tanstack/react-query'
import { api, type FileResponse } from '@/core/api'
import type { HelpArticle, HelpContents, HelpLang } from '@/core/models/help'

const seg = encodeURIComponent

export const helpApi = {
  /** `GET help/{area}?lang=` — the table of contents (each article's front matter, in order) and the draft flag. */
  contents(area: string, lang: HelpLang): Promise<HelpContents> {
    return api.get<HelpContents>(`help/${seg(area)}`, { lang })
  },
  /** `GET help/{area}/{slug}?lang=` — one article's front matter and Markdown; 404 for an unknown area or slug. */
  article(area: string, slug: string, lang: HelpLang): Promise<HelpArticle> {
    return api.get<HelpArticle>(`help/${seg(area)}/${seg(slug)}`, { lang })
  },
  /**
   * `GET help/{area}/images/{file}` — behind login, so fetched with the app's headers (`api.blob`) and shown through an
   * object URL: a plain `<img src="/api/…">` cannot send `X-Web-Client` and answers 401.
   */
  image(area: string, file: string): Promise<FileResponse> {
    return api.blob(`help/${seg(area)}/images/${seg(file)}`)
  },
}

/** Every help query's key starts here. */
export const HELP_KEY = ['help'] as const

/** An area's table of contents, in one language. */
export const helpContentsQuery = (area: string, lang: HelpLang) => ({
  queryKey: [...HELP_KEY, area, 'contents', lang] as const,
  queryFn: () => helpApi.contents(area, lang),
  staleTime: 5 * 60_000,
})

/** One article, in one language. */
export const helpArticleQuery = (area: string, slug: string, lang: HelpLang) => ({
  queryKey: [...HELP_KEY, area, 'article', slug, lang] as const,
  queryFn: () => helpApi.article(area, slug, lang),
  staleTime: 5 * 60_000,
})

/** One help image's bytes (the same file in both languages' articles is fetched once). */
export const helpImageQuery = (area: string, file: string) => ({
  queryKey: [...HELP_KEY, area, 'image', file] as const,
  queryFn: () => helpApi.image(area, file),
  staleTime: Infinity,
})

/** The table of contents hook every help surface reads. */
export const useHelpContents = (area: string, lang: HelpLang) => useQuery(helpContentsQuery(area, lang))
