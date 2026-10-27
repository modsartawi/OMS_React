/**
 * The Editions screen's doors (BackOffice 3138; oms ticket 613). The brief spells the five doors; the
 * gap report's export door (`…/Gaps/Export`) and every field beyond the diff's top level are guesses recorded
 * on the ticket.
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, `editionsStub`): no door here has met a real
 * SIS.Api. A session without the grant is answered a bare 403 (no probe until 618).
 */
import { api, type FileResponse } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import { uploadForm, type Edition, type EditionDiff, type EditionList, type GapRow } from './editions'

const BASE = `${INSURANCE_RULES_BASE}/Editions`
const one = (id: string) => `${BASE}/${encodeURIComponent(id)}`

export const editionsApi = {
  /** `GET InsuranceRules/Editions?list=` — every edition of a list, newest first; old ones read-only. */
  async history(list: EditionList): Promise<Edition[]> {
    return (await api.get<Edition[] | null>(BASE, { list })) ?? []
  },
  /** `POST InsuranceRules/Editions` multipart `{ list, file }` → `{ id }`. */
  upload(list: EditionList, file: File): Promise<{ id: string }> {
    return api.upload<{ id: string }>(BASE, uploadForm(list, file))
  },
  /** `GET InsuranceRules/Editions/{id}/Diff` — against the live edition, with the rules affected. */
  diff(id: string): Promise<EditionDiff> {
    return api.get<EditionDiff>(`${one(id)}/Diff`)
  },
  /** `POST InsuranceRules/Editions/{id}/Publish` — refused for the uploader (`UPLOADER_CANNOT_PUBLISH`, a guess). */
  publish(id: string): Promise<unknown> {
    return api.post<unknown>(`${one(id)}/Publish`, {})
  },
  /** `GET InsuranceRules/Editions/{id}/Gaps` — no match / junk code / GTIN mismatch / withdrawn. */
  async gaps(id: string): Promise<GapRow[]> {
    return (await api.get<GapRow[] | null>(`${one(id)}/Gaps`)) ?? []
  },
  /** `GET InsuranceRules/Editions/{id}/Gaps/Export` (guessed spelling) — the gap report as a file. */
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
