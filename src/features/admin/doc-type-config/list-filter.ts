/**
 * The document types list's filter (BackOffice spec 3148 story 6, ticket 3149): one category, and a search over the
 * code or the description (either case, trimmed). Pure: no React, no `t`.
 */
import type { DocumentTypeListRow } from './types'

export interface DocumentTypeFilter {
  /** `''` = every category. */
  category: string
  search: string
}

export function filterDocumentTypes(rows: readonly DocumentTypeListRow[], filter: DocumentTypeFilter): DocumentTypeListRow[] {
  const term = filter.search.trim().toLowerCase()
  return rows.filter(
    (r) =>
      (filter.category === '' || r.documentCategory === filter.category) &&
      (term === '' || r.documentType.toLowerCase().includes(term) || r.description.toLowerCase().includes(term)),
  )
}

/** The categories the list holds, each once, sorted — the category filter's options. */
export function categoriesOf(rows: readonly DocumentTypeListRow[]): string[] {
  return [...new Set(rows.map((r) => r.documentCategory))].sort()
}
