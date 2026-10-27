/**
 * A group's Members tab URL (oms ticket 632): the search and the page sit in the address — `?search=`,
 * `?page=` — so a refresh or a pasted link lands on the same page of the same search. Pure: no React,
 * no i18n. Module-level functions, as `useUrlQuery` requires.
 */

export interface MembersQuery {
  /** What the user typed, trimmed; `''` = no search. Any spelling — the server canonicalises. */
  search: string
  /** 1-based. */
  page: number
}

export function membersQueryFromParams(params: URLSearchParams): MembersQuery {
  const search = (params.get('search') ?? '').trim()
  const n = Math.floor(Number(params.get('page')))
  return { search, page: Number.isFinite(n) && n >= 1 ? n : 1 }
}

export function membersQueryToParams(q: MembersQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.search.trim()) out.set('search', q.search.trim())
  if (q.page > 1) out.set('page', String(q.page))
  return out
}
