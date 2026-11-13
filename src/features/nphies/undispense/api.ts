/**
 * The Undispense page's server calls (ticket 898, BackOffice spec 3208, Nphies contract 1.2 §1.1
 * rows 19–21). Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`); 401 is that
 * module's, and nothing here catches it.
 *
 * The probe (`Nphies/Access`, which carries `canUndispense` since 1.2) is the area's and lives in
 * `@/core/nphies/api`.
 */
import { api } from '@/core/api'
import type { NphiesUndispenseList, NphiesUndispenseQueued } from '@/core/models/nphies'
import { undispenseBody } from './undispense-rules'

/** Every list read sits under this prefix, so an act re-reads all of them at once. */
export const UNDISPENSE_LIST_KEY = ['nphies', 'undispense', 'list'] as const

export const undispenseApi = {
  /** `GET Nphies/Undispense` (§1.1 #19) — newest first, at most 500. Nphies grant only. The query
   *  is built by `buildUndispenseListParams`. */
  async list(params: Record<string, string>): Promise<NphiesUndispenseList> {
    const answer = await api.get<NphiesUndispenseList>('Nphies/Undispense', params)
    return { items: answer?.items ?? [], truncated: answer?.truncated === true, contractVersion: answer?.contractVersion }
  },

  /** `POST Nphies/Undispense/{id}/Retry` (§1.1 #20) — a FAILED request made pending again. No body.
   *  Needs the undispense grant too; without it, a bare 403. */
  retry(id: string): Promise<NphiesUndispenseQueued> {
    return api.post<NphiesUndispenseQueued>(`Nphies/Undispense/${encodeURIComponent(id)}/Retry`, {})
  },

  /** `POST Nphies/Auth/{authId}/Undispense` (§1.1 #21) — queues the undispense of one authorization
   *  whose invoice is fully returned. The body is `{ note }` alone. */
  undispense(authId: string, note: string): Promise<NphiesUndispenseQueued> {
    return api.post<NphiesUndispenseQueued>(
      `Nphies/Auth/${encodeURIComponent(authId.trim())}/Undispense`,
      undispenseBody(note),
    )
  },
}
