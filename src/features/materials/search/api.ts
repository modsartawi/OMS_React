/**
 * The Material search's server calls (ticket 451, BackOffice spec 2544). The area's access probe
 * is shared and lives in `@/core/materials/api`; these three doors are this feature's alone.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. A
 * refusal arrives as an `ApiError` — branch on it with `apiErrorCode` (`MAT-00006`), show it with
 * `apiErrorMessage`.
 *
 * The doors are BackOffice 2545/2546; their contract is
 * `C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md`. The stubbed drive
 * pins the screen; `tools/materials-live-drive.mjs` meets the real doors (ticket 455).
 */
import { api } from '@/core/api'
import type {
  MaterialFacetKind,
  MaterialFacetValue,
  MaterialLevel,
  MaterialLevelValue,
  MaterialSearchResult,
} from '@/core/models/materials'
import { levelsAbove } from './level-cascade'
import { searchApiParams, type LevelChoices, type MaterialSearchState } from './search-query'

export const materialSearchApi = {
  /**
   * `GET MaterialWeb/Search` → `{ resolvedAs, resolvedFrom, limited, rows }`. The parameters are
   * the URL's own (`searchApiParams`), lists repeated.
   */
  async search(state: MaterialSearchState): Promise<MaterialSearchResult> {
    const data = await api.get<MaterialSearchResult | null>('MaterialWeb/Search', searchApiParams(state))
    return {
      resolvedAs: data?.resolvedAs ?? null,
      resolvedFrom: data?.resolvedFrom ?? null,
      limited: data?.limited === true,
      rows: data?.rows ?? [],
    }
  },

  /**
   * `GET MaterialWeb/Levels?level=C&aLevel=…&bLevel=…` → the distinct `{ code, description }` at
   * `level` under the choices made above it, sorted by code. The empty code is never offered —
   * the door leaves it out, and it is dropped here too so it can never become a choice.
   */
  async levels(level: MaterialLevel, levels: LevelChoices): Promise<MaterialLevelValue[]> {
    const data = await api.get<MaterialLevelValue[] | null>('MaterialWeb/Levels', { level, ...levelsAbove(levels, level) })
    return (data ?? []).filter((v) => typeof v?.code === 'string' && v.code.trim() !== '')
  },

  /** `GET MaterialWeb/Facets?kind=…&q=…` → the top 50 distinct values containing `q` (absent → top
   *  50 by frequency). A vendor's `value` is its number. */
  async facets(kind: MaterialFacetKind, q: string): Promise<MaterialFacetValue[]> {
    const data = await api.get<MaterialFacetValue[] | null>('MaterialWeb/Facets', { kind, q: q.trim() })
    return data ?? []
  },
}
