/**
 * The Editions screen's doors (BackOffice 3138; oms ticket 613), reconciled with the doors as built in oms 618
 * (`editionIn` / `gapsIn` read the replies; `tools/insurance-rules-stubs.mjs`, `editionsStub`, serves the same).
 * A session without the grant is answered a bare 403 (BackOffice has no grant probe for it).
 */
import { api, type FileResponse } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import { editionIn, gapsIn, uploadForm, type Edition, type EditionDiff, type EditionList, type EditionReply, type GapRow, type GapsReply } from './editions'

const BASE = `${INSURANCE_RULES_BASE}/Editions`
const one = (id: string) => `${BASE}/${encodeURIComponent(id)}`

export const editionsApi = {
  /** `GET InsuranceRules/Editions?list=` — every edition of a list, newest first; old ones read-only. */
  async history(list: EditionList): Promise<Edition[]> {
    return ((await api.get<EditionReply[] | null>(BASE, { list })) ?? []).map(editionIn)
  },
  /** `POST InsuranceRules/Editions` multipart `{ list, file }` → the edition, `pending` (400 `EDITIONS_BAD_REQUEST`). */
  async upload(list: EditionList, file: File): Promise<Edition> {
    return editionIn(await api.upload<EditionReply>(BASE, uploadForm(list, file)))
  },
  /** `GET InsuranceRules/Editions/{id}/Diff` — against the live edition, with the rules affected. */
  diff(id: string): Promise<EditionDiff> {
    return api.get<EditionDiff>(`${one(id)}/Diff`)
  },
  /** `POST InsuranceRules/Editions/{id}/Publish` — the edition, live; 403 `EDITIONS_SELF_PUBLISH` for the uploader, 409 `EDITIONS_NOT_PENDING`. */
  publish(id: string): Promise<unknown> {
    return api.post<unknown>(`${one(id)}/Publish`, {})
  },
  /** `GET InsuranceRules/Editions/{id}/Gaps` — no match / junk code / GTIN mismatch / withdrawn. */
  async gaps(id: string): Promise<GapRow[]> {
    return gapsIn(await api.get<GapsReply | null>(`${one(id)}/Gaps`))
  },
  /** `GET InsuranceRules/Editions/{id}/Gaps/Export` — the gap report as an `.xlsx`. */
  exportGaps(id: string): Promise<FileResponse> {
    return api.blob(`${one(id)}/Gaps/Export`)
  },
}

export const EDITIONS_KEY = [...INSURANCE_RULES_KEY, 'editions'] as const

export function historyQuery(list: EditionList) {
  return { queryKey: [...EDITIONS_KEY, 'history', list], queryFn: () => editionsApi.history(list), retry: false } as const
}
export function diffQuery(id: string) {
  return { queryKey: [...EDITIONS_KEY, 'diff', id], queryFn: () => editionsApi.diff(id), retry: false } as const
}
export function gapsQuery(id: string) {
  return { queryKey: [...EDITIONS_KEY, 'gaps', id], queryFn: () => editionsApi.gaps(id), retry: false } as const
}
