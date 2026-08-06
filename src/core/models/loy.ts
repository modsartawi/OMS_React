/**
 * Loyalty member models (spec 231, field inventory 223).
 *
 * Every field below was read off a C# class rather than inferred from a name.
 * Two rules from the inventory bind this file:
 *
 * - 🚩 **Every string is nullable in TypeScript.** `LoyMemberModel` has no
 *   nullable annotations in C#, so the inventory's TS column is the authority
 *   and not the C# type.
 * - 🚩 **Dates are never null — they arrive as sentinel dates** (`0001-01-01`).
 *   Guard with `isBlankDate` from `@/core/util/date-format` before display;
 *   `birthDate` in particular is a sentinel, not a null.
 *
 * The points-engine machinery the payload also carries — `profile` (a dead
 * constant `"W|D"`), `accrualFactor`, `redemptionFactor` (always
 * `22.2222222222`), `exchangeRate`, `pointsExpireSoonDays` (a never-assigned
 * constant `30`) and `profileUpdated` — is deliberately absent: it is drawn
 * nowhere (spec 231 §5), and a model field is an invitation to draw it.
 */

/**
 * `GET LoyWeb/Access` — the area's screen-access probe (spec 231 §11), and the
 * one route on the door that is not a read. Cookie-only and deliberately **not**
 * grant-gated: it must be able to answer a session that holds nothing.
 *
 * 🚩 It reads the same `ILoyMemberScreenGate` object the route filter reads, so
 * the probe and the gate cannot disagree — and it **fails closed** on the client
 * side (ticket 234): a missing flag, a malformed answer, an unseeded grant or a
 * thrown error all read as denied. `=== true`, never truthiness.
 */
export interface LoyAccessResult {
  canOpenLoyMember: boolean
}

/** The member payload as the wire carries it — `LoyMemberModel`, verbatim. */
export interface LoyMemberPayload {
  loyId: string
  mobileCountry: string | null
  mobile: string | null
  fullName: string | null
  birthDate: string
  gender: string | null
  email: string | null
  nationality: string | null
  nationalId: string | null
  insuranceCompany: string | null
  cityCode: string | null
  preferredLanguage: string | null
  joinDate: string
  lastUpdate: string
  tier: string | null
  tierPointsBalance: number
  pendingPoints: number
  pointsBalance: number
  pointsBalanceAmount: number
  pointsBalanceAmountCurrency: string
  pointsExpireSoon: number
  /**
   * 🚩 Mapped through by the new `LoyWeb` projection (230's first amendment).
   * `M` is an ordinary member; anything else is Archived / Non-loyalty / Family
   * and earns its own header chip. Without this field the screen would present
   * an archived member as a live one with no tell.
   */
  memberType: string | null
  /**
   * 🚩 The blocked reason **CODE** — `LoyMemberActionModel.blockedReason` on the
   * Actions payload carries the already-joined English under the same name.
   * Renamed on the domain model below so the two can never be confused; the
   * split is spec 231 §6's, and this is the wire half of it.
   */
  blockedReason: string | null
}

/**
 * A loyalty member as the screen reads one. Identical to the payload but for
 * `blockedReasonCode`, whose name states which of the two meanings this is.
 */
export interface LoyMember extends Omit<LoyMemberPayload, 'blockedReason'> {
  /** The reason CODE (`CM` / `IA` / an unseeded value), never its description.
   *  Null or empty ⇒ the member is not blocked. */
  blockedReasonCode: string | null
}

/**
 * One row of `GET LoyWeb/Reports/LastActivities/{loyId}` — `LastActivityModel`,
 * narrowed to the six fields the Activities tab draws plus the key it is sorted
 * by (223 §2, columns settled by 226 §2).
 *
 * 🚩 **`points` arrives already signed.** `LoyActivityService.AddActivity`
 * negates `SpendPoints` in place for a debit, so `-450` reaches the browser as
 * `-450` — there is no client-side debit/credit table and none is needed. It is
 * also already `Round()`ed to 2 dp away-from-zero by the endpoint, which is
 * exactly why 🚩 **no client-side total is ever drawn**: a sum of rounded rows
 * will not equal the header's `pointsBalance`.
 *
 * **Dropped, deliberately** (226 §2): the whole points-engine machinery
 * (`pointsAmount`, `salesAmount`, `spendPointsFactor`, `pointsAmountInCurrency`,
 * `currency`) — that is *how* the engine computed the points, not *what
 * happened* — plus `relatedActivityId`, `refLoyId`, `effectiveTime`, `branchId`,
 * `tierPoints`, and the pre-formatted `*String` WPF conveniences.
 */
export interface LoyActivityRow {
  /** The key and the sort — `ORDER BY ActivityId DESC` is **insertion order, not
   *  date order**, so a backdated posting sorts by when it was written. Carried
   *  as the row identity, drawn in no column. */
  activityId: string
  /** The type CODE (`ACRL`, `RDEM`, …). Not drawn — `description` is the
   *  server's own English for it, joined from `LoyActivityType`. */
  activityType: string | null
  description: string | null
  activityDateTime: string
  /** `A`/`P`/`N`/`E`, closed by `LoyActivityStatusConstants` — decoded through
   *  `codes.ts`, which degrades an unseeded value to the bare code. */
  activityStatus: string | null
  /** A sentinel date when there is nothing to expire; the server's own rule is
   *  that expiry is meaningless when `points <= 0`. Both guards are the tab's. */
  expiryDate: string
  points: number
  referenceNumber: string | null
}
