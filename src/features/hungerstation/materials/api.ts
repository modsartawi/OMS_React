import { api } from '@/core/api'
import type {
  HungerStationMaterialChangeBody,
  HungerStationMaterialImportBody,
  HungerStationMaterialImportResult,
  HungerStationMaterialRow,
  HungerStationMaterialsPage,
  HungerStationMaterialsQuery,
} from '@/core/models/hungerstation'
import { materialsDoorParams } from './materials-query'

// The HungerStation materials doors (BackOffice 3035; contract § Materials). Behind
// `canManageCatalog` on the ONE HungerStation probe (`@/core/hungerstation/api`).
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every materials page, whatever its filters — the page keys each under it, an import refreshes
 *  them all and a change patches its row into each. */
export const MATERIALS_KEY = ['hungerstation', 'materials'] as const

export const materialsApi = {
  /** GET HungerStationWeb/Materials?q=&state=&skip=&take= — one server page. */
  async list(query: HungerStationMaterialsQuery): Promise<HungerStationMaterialsPage> {
    const page = await api.get<HungerStationMaterialsPage | null>('HungerStationWeb/Materials', materialsDoorParams(query))
    return { total: page?.total ?? 0, rows: page?.rows ?? [] }
  },

  /**
   * POST HungerStationWeb/Materials/Import — up to 5000 rows; a repeat counts once, its last row
   * wins. Returns added, updated and the unknown numbers (not added). Refusals: DHS-00008, 00010.
   */
  import(body: HungerStationMaterialImportBody): Promise<HungerStationMaterialImportResult> {
    return api.post<HungerStationMaterialImportResult>('HungerStationWeb/Materials/Import', body)
  },

  /**
   * PUT HungerStationWeb/Materials/{materialNumber} — set disabled and deleted. Returns the row.
   * Refusals: DHS-00008, 00009.
   */
  change(materialNumber: string, body: HungerStationMaterialChangeBody): Promise<HungerStationMaterialRow> {
    return api.put<HungerStationMaterialRow>(`HungerStationWeb/Materials/${encodeURIComponent(materialNumber)}`, body)
  },
}
