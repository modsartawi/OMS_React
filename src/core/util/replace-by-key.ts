/**
 * A cached list with the changed row swapped where it stands, matched by `key` — what a change door
 * answers (the row) patched into the list a grid holds. A list without that row, or no list, is handed
 * back as it was, so a cache update leaves it alone. Pure.
 */
export function replaceByKey<T, L extends readonly T[] | undefined>(rows: L, next: T, key: keyof T): L {
  if (!rows || !rows.some((r) => r[key] === next[key])) return rows
  return rows.map((r) => (r[key] === next[key] ? next : r)) as unknown as L
}

/**
 * A cached server page (`{ rows, … }`) with the changed row swapped where it stands, matched by `key` —
 * the total and the rest of the page untouched (a changed row stays on the page it is on until the next
 * read). A page that does not hold the row, or no page, is handed back as it was. Pure.
 */
export function replaceInPage<T, P extends { rows: readonly T[] }>(page: P | undefined, next: T, key: keyof T): P | undefined {
  if (!page) return page
  const rows = replaceByKey(page.rows, next, key)
  return rows === page.rows ? page : { ...page, rows }
}
