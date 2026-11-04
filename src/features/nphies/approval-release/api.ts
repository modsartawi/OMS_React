/**
 * The Release approval number page's server calls (ticket 751, BackOffice spec 3342, contract 1.1
 * §1.1 rows 6, 17 and 18). Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`);
 * 401 is that module's, and nothing here catches it.
 *
 * The probe (`Nphies/Access`, which carries `canReleaseApprovalNumber` since 1.1) is the area's
 * and lives in `@/core/nphies/api`.
 */
import { api } from '@/core/api'
import type {
  AuthDetail,
  NphiesApprovalNumberReleased,
  NphiesApprovalRelease,
  NphiesLookup,
  NphiesReleaseApprovalNumberRequest,
} from '@/core/models/nphies'

/** One cache entry per bundle Id for the authorization and for its history. Its own key, not the
 *  authorizations detail's: this page writes the released value into it, and the other screen's
 *  cached copy is that screen's to refresh. */
export const releaseAuthKey = (id: string) => ['nphies', 'approval-release', 'auth', id] as const
export const releaseHistoryKey = (id: string) => ['nphies', 'approval-release', 'history', id] as const

export const approvalReleaseApi = {
  /**
   * `GET Nphies/AuthResponse/{id}` (§1.1 #6) — the authorization, read through the existing
   * detail route (spec 3342). An unknown id answers `AUTH_NOT_FOUND` (404), which the page shows
   * as "not found".
   *
   * ⚠ It is a heavy read (every attachment's base64 rides on it), so it runs on Search only and
   * never on a timer.
   */
  authorization(id: string): Promise<AuthDetail> {
    return api.get<AuthDetail>(`Nphies/AuthResponse/${encodeURIComponent(id)}`)
  },

  /**
   * `POST Nphies/ApprovalNumber/Release` (§1.1 #17) — appends `_` to the approval number and logs
   * it. Needs the Nphies grant AND the release grant; without the second it is a bare 403.
   * The body is built by `releaseBody` — `{ authId, note }` and nothing else.
   */
  release(body: NphiesReleaseApprovalNumberRequest): Promise<NphiesApprovalNumberReleased> {
    return api.post<NphiesApprovalNumberReleased>('Nphies/ApprovalNumber/Release', body)
  },

  /** `GET Nphies/ApprovalNumber/Releases/{authId}` (§1.1 #18) — newest first; none is `[]`. */
  async history(authId: string): Promise<NphiesApprovalRelease[]> {
    const answer = await api.get<NphiesLookup<NphiesApprovalRelease>>(
      `Nphies/ApprovalNumber/Releases/${encodeURIComponent(authId)}`,
    )
    return answer?.items ?? []
  },
}
