/**
 * A cached list with the changed row swapped where it stands, matched by `key` — what a change door
 * answers (the row) patched into the list a grid holds. A list without that row, or no list, is handed
 * back as it was, so a cache update leaves it alone. Pure.
 */
export function replaceByKey<T, L extends readonly T[] | undefined>(rows: L, next: T, key: keyof T): L {
  if (!rows || !rows.some((r) => r[key] === next[key])) return rows
  return rows.map((r) => (r[key] === next[key] ? next : r)) as unknown as L
}
