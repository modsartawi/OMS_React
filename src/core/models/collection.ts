/**
 * Collections area models (spec 249).
 *
 * Only the access probe lives here today — the four grids' row models and the two
 * documents' print-ready contracts arrive with their own slices. The rule that
 * governs everything that joins this file later is spec 249's §0: **the client
 * cannot format**, so a money field on a document contract is a pre-formatted
 * `string` and never a `number`.
 */

/**
 * `GET CollectionWeb/Access` — the whole area's probe (spec 249 §"Getting in",
 * 244 §10). **One call, four booleans**: the menu needs all four at once to draw
 * one group, and four probes would be four round trips to answer one question.
 *
 * The four flags map 1:1 onto the four existing WPF `ControllerID` grants —
 * `CollectionInquiry`, `AcrInquiry`, `DepositInquiry`, `CollectionAttempts` —
 * reused unchanged, so a WPF user's current rights carry to the web and no new
 * permission is designed or seeded. Supervisor versus accountant is which of
 * these four finance assigned, not a different screen.
 *
 * ⚠️ **The probe only hides the menu.** The endpoint grant filter is the real
 * boundary: a hand-typed URL must be refused by the server, not merely unlinked
 * by the client. Both exist for different reasons and neither substitutes for
 * the other.
 *
 * ⚠️ **The door does not exist yet** — BackOffice 1090 owns it, and ticket 259
 * is the wave-joining event. Until then this route answers a bare 403 (issue
 * 802's default-deny inversion), which the client reads as "no group", the
 * correct posture for an unbuilt door.
 */
export interface CollectionAccessResult {
  canOpenCollections: boolean
  canOpenAcrs: boolean
  canOpenDeposits: boolean
  canOpenAttempts: boolean
}
