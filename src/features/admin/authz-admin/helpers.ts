// Pure, framework-free helpers for the Authorization-Admin screen: role-kind
// classification for the assigned-role chips, grant rendering for the effective-authz
// inspector, delegation-scope tests over the Access probe, and zone-safe stamp
// formatting. i18n text lives in the authz-admin namespace; these return data/tones.

import type { EffectiveAuthorization, RoleCatalogEntry } from '@/core/models/authz-admin'

/** The `["*"]` collapse value the Access probe passes through raw for a full admin. */
export const FULL_SCOPE = '*'

/** True when the delegation list is full-admin (`["*"]`) — everything is in scope. */
export function isFullScope(list: string[] | undefined): boolean {
  return !!list && list.length === 1 && list[0] === FULL_SCOPE
}

/**
 * Whether `roleName` is in the actor's delegated scope, given an assignable/revocable
 * list from the Access probe. Full scope (`["*"]`) covers everything; otherwise the
 * exact name must be present. The server re-checks every mutation regardless — this
 * only tiers the UI (out-of-scope chips read-only, picker filtered).
 */
export function inScope(roleName: string, list: string[] | undefined): boolean {
  if (isFullScope(list)) return true
  return !!list && list.includes(roleName)
}

export type RoleKind = 'single' | 'composite' | 'system'

/** Chip kind for a role, from the catalog: system (protected) wins over composite. */
export function roleKind(entry: RoleCatalogEntry | undefined): RoleKind {
  if (!entry) return 'single'
  if (entry.isProtected) return 'system'
  return entry.isComposite ? 'composite' : 'single'
}

/** Index a role catalog by name for O(1) chip/picker lookups. */
export function indexRoles(catalog: RoleCatalogEntry[] | undefined): Map<string, RoleCatalogEntry> {
  const map = new Map<string, RoleCatalogEntry>()
  for (const r of catalog ?? []) map.set(r.roleName, r)
  return map
}

/** The object+field-values shape shared by every grant projection (effective-authz
 *  rows AND bindable/bound catalog entries) — what {@link grantText} needs to render. */
export type GrantShape = { objectName: string; fieldValues: Record<string, string[]> }

/**
 * Render one grant's object + field values verbatim, exactly as the mock does:
 *   `*` / `*`                        → the everything grant
 *   `OBJECT`                         → object with no fields
 *   `OBJECT[FIELD=v1,v2 · FIELD2=*]` → object with fields (values joined)
 * `*` and `$VAR` values are preserved literally (never resolved). Returns the string
 * plus a `wildcard` flag (any value is `*`, or the object itself is `*`).
 */
export function grantText(g: GrantShape): {
  text: string
  wildcard: boolean
} {
  const fields = Object.entries(g.fieldValues ?? {})
  const wildcard =
    g.objectName === '*' || fields.some(([, vals]) => (vals ?? []).some((v) => v === '*'))

  if (g.objectName === '*') return { text: '* / *', wildcard: true }
  if (fields.length === 0) return { text: g.objectName, wildcard }

  const inner = fields
    .map(([field, vals]) => `${field}=${(vals ?? []).join(',')}`)
    .join(' · ')
  return { text: `${g.objectName}[${inner}]`, wildcard }
}

/** Provenance label for an effective grant: `role` or `role → member`. */
export function provenance(g: EffectiveAuthorization): string {
  return g.viaMember ? `${g.viaRole} → ${g.viaMember}` : g.viaRole
}

/**
 * Render a server DateTime EXACTLY as stored, with no timezone math — the audit
 * column mixes local and legacy-UTC rows with no per-row zone indicator, so any
 * `new Date()` round-trip would silently shift the legacy rows (contract §5,
 * no-utc-time rule). Pure string slice: "2026-07-14T11:03:22" → "2026-07-14 11:03".
 */
export function formatStamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  return iso.replace('T', ' ').slice(0, 16)
}
