/**
 * A serving list as the screens name it (BackOffice spec 3042, oms 567-572): its name in the UI language, its
 * screen's path, and a callout's serving list as one value. In `@/core/` because the Serving lists screen
 * (567-571), the Dispatch board's inspector (541) and a delivery's Callout sub-tab (542) all read them. Pure.
 */

/**
 * The list's name in the UI language — the Arabic name under Arabic — falling back to the other language's when
 * that one is blank; trimmed; `''` when both are.
 */
export function servingListName(names: { nameEn?: string | null; nameAr?: string | null }, lang: string): string {
  const en = (names.nameEn ?? '').trim()
  const ar = (names.nameAr ?? '').trim()
  return lang.startsWith('ar') ? ar || en : en || ar
}

/** The serving list's own screen (567's route). */
export const servingListHref = (id: string) => `/oms/serving-lists/${encodeURIComponent(id)}`

/**
 * A callout's serving list (spec 3042, oms 572): the name in the UI language, else the id alone when the list is
 * gone; `none` (the dash) when the type had no list. `named` is false when the label IS the id, so it is drawn
 * as a machine value.
 */
export type ServingListView = { kind: 'none' } | { kind: 'list'; id: string; label: string; named: boolean }

export function servingListView(
  c: { servingListId?: string | null; servingListNameEn?: string | null; servingListNameAr?: string | null },
  lang: string,
): ServingListView {
  const id = (c.servingListId ?? '').trim()
  if (!id) return { kind: 'none' }
  const name = servingListName({ nameEn: c.servingListNameEn, nameAr: c.servingListNameAr }, lang)
  return name ? { kind: 'list', id, label: name, named: true } : { kind: 'list', id, label: id, named: false }
}
