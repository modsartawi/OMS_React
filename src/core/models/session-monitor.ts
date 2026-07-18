// Wire shapes for the UaAdminWeb/Sessions* endpoints (map 001, spec 006). Field
// casing is the camelCase ASP.NET Core emits. The estate-wide session monitor is
// gated by its OWN grant (BackOfficeScreen[UaSessions,03]), separate from Ua Users.
//
// Ticket 007 is the access spine — only the grant probe lives here. The
// ActiveSessionRow list shape lands with ticket 008 (searchingLiveSessions…).

/** GET UaAdminWeb/Sessions/Access — the screen-open grant probe (show/hide only). */
export interface SessionAccessResult {
  canOpen: boolean
}
