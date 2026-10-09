/**
 * The Material search as it lives in the URL (ticket 451, spec 2544). Pure.
 *
 * 🔑 **The URL is the single source of truth**: a search is a shareable link. The page reads its
 * state from the address with `searchFromParams` and writes every change back with
 * `searchToParams`; nothing about the search is kept anywhere else.
 *
 * The URL's parameters ARE the door's (contract § `GET MaterialWeb/Search`): the same names, and a
 * list travels as a REPEATED key (`aLevel=A006&aLevel=A008`), never a joined one. Blocked and
 * serialised absent mean "any"; take absent means the server's default (200). So the address a
 * user shares and the query the server receives are one and the same string, and
 * URL → state → URL comes back unchanged.
 */
import type { MaterialLevel } from '@/core/models/materials'

/** The five hierarchy levels, top to bottom — the cascade's order. */
export const MATERIAL_LEVELS: readonly MaterialLevel[] = ['A', 'B', 'C', 'D', 'E']

/** A level's query parameter: `aLevel` … `eLevel`. */
export type LevelParam = `${Lowercase<MaterialLevel>}Level`
export const levelParam = (level: MaterialLevel): LevelParam =>
  `${level.toLowerCase() as Lowercase<MaterialLevel>}Level`

/** The four typeahead side filters (each a `MaterialWeb/Facets` kind) — exact values, repeatable. */
export const FACET_FILTERS = ['vendor', 'brand', 'manufacturer', 'status'] as const
export type FacetFilter = (typeof FACET_FILTERS)[number]

/** A three-state filter: absent on the wire is `any`. */
export type TriState = 'any' | 'yes' | 'no'

/** The server's default and its maximum `take` (contract). */
export const TAKE_DEFAULT = 200
export const TAKE_MAX = 500
/** What the page offers; any whole number from 1 to the maximum round-trips from a URL. */
export const TAKE_CHOICES: readonly number[] = [TAKE_DEFAULT, TAKE_MAX]

export type LevelChoices = Record<MaterialLevel, string[]>

export interface MaterialSearchState {
  /** The smart box: material number, EN/AR words, barcode, a raw GS1 scan, an SFDA/Wasfaty code. */
  q: string
  levels: LevelChoices
  vendor: string[]
  brand: string[]
  manufacturer: string[]
  status: string[]
  itemType: number[]
  blocked: TriState
  serialised: TriState
  /** `null` = the server's default. */
  take: number | null
}

export const emptyLevels = (): LevelChoices => ({ A: [], B: [], C: [], D: [], E: [] })

/** No search at all: the page's landing state. */
export function emptySearch(): MaterialSearchState {
  return {
    q: '',
    levels: emptyLevels(),
    vendor: [],
    brand: [],
    manufacturer: [],
    status: [],
    itemType: [],
    blocked: 'any',
    serialised: 'any',
    take: null,
  }
}

/** A list's values, blanks dropped and each kept once in its first position. Values are strings
 *  and stay strings: a vendor or level code keeps its leading zeros. */
const distinct = (values: readonly string[]): string[] => [...new Set(values.filter((v) => v.trim() !== ''))]

const triFrom = (value: string | null): TriState => (value === 'true' ? 'yes' : value === 'false' ? 'no' : 'any')
const triTo = (value: TriState): string | null => (value === 'yes' ? 'true' : value === 'no' ? 'false' : null)

const INT = /^-?\d+$/

/** `take` as a number when it is a whole number from 1 to the maximum, else the default (`null`). */
function takeFrom(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return n >= 1 && n <= TAKE_MAX ? n : null
}

/** The search a URL describes. Anything malformed reads as its "any"/default. */
export function searchFromParams(params: URLSearchParams): MaterialSearchState {
  const levels = emptyLevels()
  for (const level of MATERIAL_LEVELS) levels[level] = distinct(params.getAll(levelParam(level)))
  return {
    q: params.get('q') ?? '',
    levels,
    vendor: distinct(params.getAll('vendor')),
    brand: distinct(params.getAll('brand')),
    manufacturer: distinct(params.getAll('manufacturer')),
    status: distinct(params.getAll('status')),
    itemType: [...new Set(params.getAll('itemType').filter((v) => INT.test(v)).map(Number))],
    blocked: triFrom(params.get('blocked')),
    serialised: triFrom(params.get('serialised')),
    take: takeFrom(params.get('take')),
  }
}

/**
 * The search as its URL / door parameters, in the contract's order: `q`, `aLevel`…`eLevel`,
 * `vendor`, `brand`, `manufacturer`, `status`, `blocked`, `serialised`, `itemType`, `take`.
 * A blank `q`, an empty list, an `any` and an absent take (`null`) are left off. A take read from
 * the URL is written back as it came — even `take=200` — so URL → state → URL stays unchanged;
 * the page's own select writes the default as absent.
 */
export function searchToParams(state: MaterialSearchState): URLSearchParams {
  const qs = new URLSearchParams()
  if (state.q.trim() !== '') qs.set('q', state.q)
  for (const level of MATERIAL_LEVELS)
    for (const code of distinct(state.levels[level])) qs.append(levelParam(level), code)
  for (const facet of FACET_FILTERS) for (const value of distinct(state[facet])) qs.append(facet, value)
  const blocked = triTo(state.blocked)
  if (blocked) qs.set('blocked', blocked)
  const serialised = triTo(state.serialised)
  if (serialised) qs.set('serialised', serialised)
  for (const type of new Set(state.itemType)) qs.append('itemType', String(type))
  if (state.take !== null) qs.set('take', String(state.take))
  return qs
}

/** The search as one query string, without the `?` — the URL's and the cache key's. */
export const searchQueryString = (state: MaterialSearchState): string => searchToParams(state).toString()

/** The keys that carry one value; every other key is a list. */
const SINGLE_KEYS: ReadonlySet<string> = new Set(['q', 'blocked', 'serialised', 'take'])

/**
 * The same parameters in the shape `api.get` takes: every list key as an array (even with one
 * value), so `buildQuery` sends it repeated (`api-envelope`) and the shape never depends on a count.
 */
export function searchApiParams(state: MaterialSearchState): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  searchToParams(state).forEach((value, key) => {
    if (SINGLE_KEYS.has(key)) out[key] = value
    else out[key] = [...((out[key] as string[] | undefined) ?? []), value]
  })
  return out
}

/** True when the state asks anything at all: a text, a level, a side filter. `take` alone is not
 *  a search. The page asks the door only then. */
export function hasSearch(state: MaterialSearchState): boolean {
  return (
    state.q.trim() !== '' ||
    MATERIAL_LEVELS.some((level) => state.levels[level].length > 0) ||
    FACET_FILTERS.some((facet) => state[facet].length > 0) ||
    state.itemType.length > 0 ||
    state.blocked !== 'any' ||
    state.serialised !== 'any'
  )
}

/**
 * An item type as typed into its box: a whole number, or `null`. The contract's `itemType` is an
 * int and has no typeahead kind, so the box takes the number itself.
 */
export function parseItemType(text: string): number | null {
  const t = text.trim()
  return INT.test(t) ? Number(t) : null
}
