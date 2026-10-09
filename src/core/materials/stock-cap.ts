// The stock check's 50-material cap (spec 2544, `POST MaterialWeb/Stock` → MAT-00002 over 50),
// said on the client BEFORE the call — by the search page's "check stock for selected" (451) and
// by the stock check's own input (453). Both refuse the 51st through this ONE constant and this ONE
// refusal key, so the two can never disagree about the number or the sentence. Pure.

/** The most materials one stock check may ask about (the server's own limit). */
export const STOCK_MATERIAL_CAP = 50

/**
 * The refusal sentence's key. It lives in the `materials-search` namespace because that is the
 * area's first namespace and owns its shared words (the menu labels sit beside it); a core module
 * cannot own a namespace of its own without a second registration. Render it through `<Trans>`
 * with `values={{ max }}` and an `<n>` slot so the number is isolated.
 */
export const STOCK_CAP_REFUSAL_KEY = 'materials-search:shared.stockCapRefused'

/** The stock check's address, and the repeatable query parameter that carries each material. */
export const STOCK_CHECK_PATH = '/materials/stock'
export const STOCK_MATERIAL_PARAM = 'material'

/** True when `count` materials is more than one stock check may ask about. */
export const overStockCap = (count: number): boolean => count > STOCK_MATERIAL_CAP

/**
 * `/materials/stock?material=…&material=…` for the given materials, in order, each once. The
 * numbers travel as the strings they are (leading zeros kept). `null` when the list is empty or
 * over the cap — the caller refuses rather than sending a link the stock check would refuse.
 */
export function stockCheckHref(materials: readonly string[]): string | null {
  const unique = [...new Set(materials.map((m) => m.trim()).filter((m) => m !== ''))]
  if (unique.length === 0 || overStockCap(unique.length)) return null
  const qs = new URLSearchParams()
  for (const m of unique) qs.append(STOCK_MATERIAL_PARAM, m)
  return `${STOCK_CHECK_PATH}?${qs.toString()}`
}
