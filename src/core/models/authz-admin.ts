// Wire shapes for the AuthzAdminWeb/* endpoints (map 445, spec 453, tickets 460/461).
// Field casing is the camelCase ASP.NET Core emits; every classification comes back
// as a RAW string code (the client owns the code→label mapping — contract 447 §5).
// The person-search grid REUSES the Ua Admin `UaEmployeeGridRow`/`UaEmployeeSearchResult`
// shapes (the endpoint calls the same `UaAdminService.SearchEmployeesAsync`), so those
// live in `ua-user.ts` and are imported where needed rather than re-declared here.

/**
 * GET AuthzAdminWeb/Access — the rich entry probe (AuthzAdminAccess). Drives BOTH
 * the shell's permission-aware nav hiding (429) AND the in-page pane tiering:
 *  - `screenAllowed` = holds the BackOfficeScreen[AuthzAdmin,03] grant (open the screen);
 *  - `canManageRoles`/`canManageUsers` = the two maint tier flags (advisory — the server
 *    re-checks every mutation);
 *  - `assignableRoles`/`revocableRoles` = exact role names the actor may assign/revoke,
 *    OR the raw `["*"]` collapse value (full delegation) the client special-cases.
 */
export interface AuthzAccessResult {
  screenAllowed: boolean
  canManageRoles: boolean
  canManageUsers: boolean
  assignableRoles: string[]
  revocableRoles: string[]
}

/** One row of the role catalog (RoleCatalogEntry) — used here to classify a person's
 *  assigned-role chips (composite / system) and to describe the assignable picker. */
export interface RoleCatalogEntry {
  roleName: string
  description: string
  isComposite: boolean
  directHolderCount: number
  isProtected: boolean
}

/**
 * One grant, rendered verbatim (GrantCatalogEntry) — object + field values with `*`
 * wildcards and `$VARIABLE` values preserved. Backs both the bindable-grant catalog
 * picker and a role's currently-bound grants (RoleDetail.boundGrants). Read-only: the
 * module binds/unbinds existing grants, never creates or edits them.
 */
export interface GrantCatalogEntry {
  authorizationId: string
  objectName: string
  /** field name → its verbatim values (may contain `*` and `$VAR`). */
  fieldValues: Record<string, string[]>
}

/**
 * Detail for one role (RoleDetail) — the catalog row plus composite membership and the
 * grants bound directly to it. `memberSingleRoleNames` is populated for a composite
 * (empty for a single); `boundGrants` is populated for a single (empty for a composite,
 * whose authority comes from its member singles). `directHolderCount` + the two lists
 * feed the delete-in-use guard's counts client-side.
 */
export interface RoleDetail {
  roleName: string
  description: string
  isComposite: boolean
  directHolderCount: number
  isProtected: boolean
  /** member single-role names for a composite; empty for a single. */
  memberSingleRoleNames: string[]
  /** grants bound directly to this role; empty for a composite. */
  boundGrants: GrantCatalogEntry[]
}

/** A person who holds a role directly (RoleHolder) — for the role's "Held by" tab. */
export interface RoleHolder {
  userId: string
  displayName: string
  isActive: boolean
}

/**
 * One row of the effective-authorizations inspector (EffectiveAuthorization): a single
 * grant the person effectively holds, its verbatim field values (`*` wildcards and
 * `$VARIABLE` values preserved) and the provenance of HOW they hold it.
 */
export interface EffectiveAuthorization {
  authorizationId: string
  objectName: string
  /** field name → its verbatim values (may contain `*` and `$VAR`). */
  fieldValues: Record<string, string[]>
  /** the person's DIRECTLY-assigned role the grant was reached through. */
  viaRole: string
  /** the member single-role a composite reached it through, or null for a direct single. */
  viaMember: string | null
}

/**
 * One UaAdminAudit row (AuthzAuditRow). The audit read returns a BARE ARRAY (unlike
 * the Ua Admin audit's `{ entries }` wrapper). `timestamp` is as-stored (mixes local
 * and legacy-UTC) — NEVER convert (contract §5 / no-utc-time).
 */
export interface AuthzAuditRow {
  entryId: string
  timestamp: string
  performedBy: string
  action: string
  targetId: string
  details: string
}
