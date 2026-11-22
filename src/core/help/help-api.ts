/**
 * The help endpoint's client (oms 951, BackOffice 4183) and its TanStack Query options — in core so the help page, the
 * drawer and print page (`features/help`), and the copilot's "How do I…?" row (952) share one cache.
 *
 * Reconciled with BackOffice pricing2 @ 98f9a5ad9 (4183/4184/4188): the wire shapes are in `@/core/models/help`.
 */
import { useQuery } from '@tanstack/react-query'
import { api, type FileResponse } from '@/core/api'
import {
  HELP_ACCESS,
  type HelpAccess,
  type HelpArticle,
  type HelpArticleMeta,
  type HelpArticleReply,
  type HelpContents,
  type HelpContentsReply,
  type HelpLang,
  type HelpSection,
  type HelpTour,
  type HelpTourStep,
} from '@/core/models/help'

const seg = encodeURIComponent

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const line = (v: unknown): string => (typeof v === 'string' ? v : '')
const objects = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []
const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

const rank = (level: string): number => {
  const at = (HELP_ACCESS as readonly string[]).indexOf(level)
  return at < 0 ? HELP_ACCESS.length : at
}

/**
 * An access list as every surface reads it: lowest first, once each (the front matter does not always write it in
 * order — `09-copilot-admin.md` has `[curator, viewer]`), a level the app does not know kept, last. A lone string (an
 * older shape) reads as a list of one.
 */
export function helpAccessOf(v: unknown): HelpAccess[] {
  const levels = typeof v === 'string' ? [v] : list(v)
  const once = [...new Set(levels.map((l) => l.trim()).filter(Boolean))]
  return once.map((l, i) => ({ l, i })).sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i).map((x) => x.l as HelpAccess)
}

/**
 * One article's front matter as every help surface reads it: a missing list reads as none, a missing line as blank —
 * normalised once here, where the wire answer is read, so search and print never meet an undefined (review 4182 #2).
 */
function helpMetaOf(raw: unknown): HelpArticleMeta {
  const r = record(raw)
  return {
    slug: line(r.slug),
    title: line(r.title),
    order: typeof r.order === 'number' && Number.isFinite(r.order) ? r.order : 0,
    access: helpAccessOf(r.access),
    screens: list(r.screens),
    questions: list(r.questions),
    checkedAgainst: line(r.checkedAgainst),
  }
}

const stepOf = (r: Record<string, unknown>): HelpTourStep => ({
  id: line(r.id),
  target: line(r.target),
  route: line(r.route),
  title: line(r.title),
  body: line(r.body),
  ticksWhen: typeof r.ticksWhen === 'string' && r.ticksWhen !== '' ? r.ticksWhen : null,
})

const tourOf = (r: Record<string, unknown>): HelpTour => ({ id: line(r.id), title: line(r.title), access: helpAccessOf(r.access), steps: objects(r.steps).map(stepOf) })

const sectionOf = (r: Record<string, unknown>): HelpSection => ({
  anchor: line(r.anchor),
  heading: line(r.heading),
  level: typeof r.level === 'number' ? r.level : 0,
})

/** The table of contents as read: no `articles` or `tours` is none, no `draft` is not draft. */
export function helpContentsOf(raw: HelpContentsReply): HelpContents {
  const r = record(raw)
  return { draft: r.draft === true, articles: objects(r.articles).map(helpMetaOf), tours: objects(r.tours).map(tourOf) }
}

/** One article as read: its nested front matter flattened beside its Markdown (none = an empty body) and its sections. */
export function helpArticleOf(raw: HelpArticleReply): HelpArticle {
  const r = record(raw)
  return { ...helpMetaOf(r.article), markdown: line(r.markdown), sections: objects(r.sections).map(sectionOf) }
}

export const helpApi = {
  /** `GET Help/{area}?lang=` — the table of contents (each article's front matter, in order), the tours and the draft flag. */
  contents(area: string, lang: HelpLang): Promise<HelpContents> {
    return api.get<HelpContentsReply>(`Help/${seg(area)}`, { lang }).then(helpContentsOf)
  },
  /** `GET Help/{area}/{slug}?lang=` — one article's front matter, Markdown and sections; 404 for an unknown area or slug. */
  article(area: string, slug: string, lang: HelpLang): Promise<HelpArticle> {
    return api.get<HelpArticleReply>(`Help/${seg(area)}/${seg(slug)}`, { lang }).then(helpArticleOf)
  },
  /**
   * `GET Help/{area}/images/{file}` — behind login, so fetched with the app's headers (`api.blob`) and shown through an
   * object URL: a plain `<img src="/api/…">` cannot send `X-Web-Client` and answers 401.
   */
  image(area: string, file: string): Promise<FileResponse> {
    return api.blob(`Help/${seg(area)}/images/${seg(file)}`)
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
