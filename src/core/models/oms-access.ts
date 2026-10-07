// Wire shape for GET SdDocumentWeb/Access (BackOffice 750; grants seeded by 749).
// The OMS area moved behind a cookie-only `SdDocumentWeb/*` door in ticket 125 — before
// that every OMS endpoint was open to any authenticated session, including the write
// doors (UpdateDocument, RescheduleDelivery, …). Field casing is the camelCase
// ASP.NET Core emits.

/**
 * The two OMS screen-open grants, as booleans. The client never sends or compares a
 * grant string — these are the only place the names appear client-side, and only as
 * documentation:
 *
 * - `canOpenList`   ← `BackOfficeScreen[DocumentList,03]`   — Delivery Documents list.
 * - `canOpenDetail` ← `BackOfficeScreen[DocumentDetails,03]` — Document Details, the
 *   deep-linkable screen that carries the update/reschedule write doors.
 *
 * Two grants, not one: the list is a read and the detail screen writes, so a session
 * may hold the first without the second (ticket 125, OQ2).
 *
 * - `canMarkDelivered` ← `BackOfficeScreen[OmsMarkDelivered,06]` — Mark delivered on
 *   Document Details (BackOffice spec 2417, ticket 2421). Reported on its own: the
 *   command is drawn only when it is `true` AND the session can open Document Details.
 *   Optional because an older SIS.Api does not send it, and absent must read as denied.
 */
export interface OmsAccessResult {
  canOpenList: boolean
  canOpenDetail: boolean
  canMarkDelivered?: boolean
}
