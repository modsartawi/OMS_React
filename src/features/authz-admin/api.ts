import { api } from '@/core/api'
import type { UaEmployeeSearchResult } from '@/core/models/ua-user'
import type {
  AuthzAccessResult,
  AuthzAuditRow,
  EffectiveAuthorization,
  RoleCatalogEntry,
} from '@/core/models/authz-admin'

const BASE = 'AuthzAdminWeb'
const encode = (segment: string) => encodeURIComponent(segment)

// Reads are capped at 50 server-side (take clamps down); the screen shows the
// first page and the "refine to narrow" cap note rather than offset-paging.
const PAGE = { skip: 0, take: 50 }

export const authzAdminApi = {
  // The rich screen-open + tiering probe. Drives BOTH the in-page route-guard (the
  // "no access" card + pane tiering) AND the shell's permission-aware nav hiding
  // (429) — the shell's probe shares this exact ['authz-admin','access'] cache
  // entry, so it's one call, not two. The server re-checks the grant on every
  // AuthzAdminWeb/* call regardless; the menu hide is show/hide hygiene only.
  access(): Promise<AuthzAccessResult> {
    return api.get<AuthzAccessResult>(`${BASE}/Access`)
  },

  // Person search — the SAME spine search the Ua Admin screen uses, capped at 50,
  // behind the AUTHZ gate (holding the authz grant never implies the UaUsers screen).
  search(term: string): Promise<UaEmployeeSearchResult> {
    return api.get<UaEmployeeSearchResult>(`${BASE}/Employees`, { term, ...PAGE })
  },

  // The whole role catalog (single + composite, kind + protected flag), for chip
  // classification and the assignable picker's descriptions.
  roleCatalog(): Promise<RoleCatalogEntry[]> {
    return api.get<RoleCatalogEntry[]>(`${BASE}/Roles`)
  },

  // A person's DIRECTLY-assigned role names (composites NOT flattened) — the
  // removable-chip truth. Empty for someone with no UaUser row yet.
  assignedRoles(userId: string): Promise<string[]> {
    return api.get<string[]>(`${BASE}/Users/${encode(userId)}/Roles`)
  },

  // The effective-authz inspector payload — composites expanded, grants deduped by
  // AuthorizationId, provenance + verbatim field values.
  effectiveAuthorizations(userId: string): Promise<EffectiveAuthorization[]> {
    return api.get<EffectiveAuthorization[]>(`${BASE}/Users/${encode(userId)}/EffectiveAuthorizations`)
  },

  // Per-user audit trail — a BARE ARRAY (not an { entries } wrapper), newest-first,
  // filtered to this person via `target`. Times as-stored (no conversion).
  audit(userId: string): Promise<AuthzAuditRow[]> {
    return api.get<AuthzAuditRow[]>(`${BASE}/Audit`, { target: userId, ...PAGE })
  },

  // Mutations — actor is the cookie UserId server-side; the body carries no actor.
  // Each returns { success: true } (no domain body); callers re-read after.
  assignRole(userId: string, roleName: string): Promise<unknown> {
    return api.post(`${BASE}/Users/AssignRole`, { userId, roleName })
  },
  revokeRole(userId: string, roleName: string): Promise<unknown> {
    return api.post(`${BASE}/Users/RevokeRole`, { userId, roleName })
  },
}
