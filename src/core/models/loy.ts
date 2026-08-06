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

/**
 * One row of `GET LoyWeb/Reports/LoyaltySales/{loyId}` — `LoyaltySalesLine`,
 * narrowed to the eight-and-a-bit fields the Sales tab draws (223 §3, columns
 * settled by 226 §4).
 *
 * 🚩 **A row is one sales LINE — one item on one receipt**, not one transaction.
 * A five-item basket is five rows sharing a `trxNumber`.
 *
 * 🚩 **`qty` and `amount` are signed on a return; `unitPrice` is not.** A return
 * line reads `-1.00 · 12.00 · -12.00`. That is the receipt, and the tab matches
 * it rather than tidying it.
 *
 * 🚩 **`trxDate` is a date, not a stamp.** `TrxTime` is a separate column the
 * report does not select, so rendering `HH:mm` would print a fabricated `00:00`
 * on every row. Corollary: lines within one day tie and their relative order is
 * undefined.
 *
 * 🚩 **`currency` is per-row plant master data** (SAP `WAERS`), not a screen
 * constant — Bahrain BHD stores are live, and the column is nullable so old rows
 * can be empty. Money on this tab formats through the feature's own
 * `formatMoneyIn`, never the app's fixed-2dp `formatMoney`.
 *
 * **Dropped, deliberately** (226 §4): `trxTypeNumber` / `documentTypeNumber` —
 * the raw twins of the enum-name strings — and `trxType` / `docType` themselves.
 * The signed qty and amount already mark a return, the channel (Insurance,
 * Wasfaty, CallCenter, ECommerce…) is not what an agent opens this tab for, and
 * both are emitted with `Enum.ToString()`, so an undefined value serialises as
 * the number as a string — neither is a closed union in TypeScript.
 *
 * Two source caveats to expect in the data, neither a bug to chase: the SQL has
 * **no `LineType` filter**, so non-item lines (discount, donation) can appear as
 * rows; and the **`INNER JOIN Item`** means a line whose item no longer exists
 * vanishes silently.
 */
export interface LoySalesRow {
  /** Bare store code — the report joins no store name. */
  storeCode: string | null
  /** The receipt number, repeated across the lines of one basket. */
  trxNumber: string | null
  /** Date-only in practice — see the note above. */
  trxDate: string
  itemNumber: string | null
  /** Joined from `Item.Description`. The row's headline: "what did they buy". */
  itemDescription: string | null
  /** 🚩 Unsigned even on a return. */
  unitPrice: number
  /** `QuantityValue` — signed on a return. */
  qty: number
  /** `AmountValue`, the line NET value column (not gross) — signed on a return. */
  amount: number
  currency: string | null
}

/**
 * One row of `GET LoyWeb/Reports/LoyMemberActions` — `LoyMemberActionModel`,
 * narrowed to the seven fields the Actions tab draws plus the key it is sorted
 * by (223 §4, columns settled by 226 §5).
 *
 * 🚩 **The entire member snapshot is absent, and that is the point.** The wire
 * row is denormalised with `mobile`, `fullName`, `email`, `gender`, `cityName`,
 * `profileUpdated`, `insuranceCompany`, `blockedReason` and `joinedDate` — the
 * member already on screen in the header, repeated 25 times a page, putting PII
 * in a grid for no reading benefit. The type does not carry them, so no column
 * can accidentally reach one.
 *
 * 🚩 **`blockedReason` is the second half of the trap the model layer exists to
 * close.** On this payload it is the already-joined English **description**; on
 * `LoyMemberPayload` it is the **code**, under the same name. No shared type
 * spans the two, and dropping the field here means the confusion has nowhere to
 * happen (spec 231 §6).
 *
 * **Both description fields are LEFT JOINs** and go null on an unknown code —
 * each falls back to its raw code at the column, never to an empty cell.
 */
export interface LoyMemberActionRow {
  /** The key and the sort — `ORDER BY ActionNo DESC`. Carried as the row
   *  identity, drawn in no column (226 §9: no row links anywhere). */
  actionNo: string
  /** The action CODE. Not drawn on its own — it is what the description column
   *  falls back to when the LEFT JOIN found no English for it. */
  mainActionType: string | null
  mainActionDescription: string | null
  subActionType: string | null
  subActionDescription: string | null
  actionDateTime: string
  /** Free-form and **untyped** — what changed, in whatever shape the writing
   *  code chose. Rendered verbatim; the screen makes no claim about it. */
  actionData: string | null
  /** The second free-form slot. 🚩 **Shown** — the user's ruling over the
   *  recommendation to drop it: nothing is hidden from the agent, even where the
   *  field is undocumented and empty on most rows. */
  actionData2: string | null
  /** **Who did it** — the back-office operator. The point of an audit tab. */
  userId: string | null
  /** A bare code; the report joins no branch name and the door carries no
   *  lookup (229). */
  branchId: string | null
}

/**
 * The paged envelope `LoyMemberActionReportResult` carries **inside** the
 * universal envelope's `data` (223 §4).
 *
 * 🚩 **This is the only one of the three reads that tells the truth about
 * volume.** `recordsCount` is a real `COUNT(*)`, not a window — which is why the
 * Actions tab states a total where the other two state a ceiling, and why its
 * Next button is arithmetic rather than a flag (`pagerButtonEnablement`'s
 * total-bearing path, ticket 232).
 */
export interface LoyMemberActionsPage {
  records: LoyMemberActionRow[] | null
  currentPage: number
  pageSize: number
  /** Rows in **this** page. */
  pageRecordsCount: number
  totalPages: number
  /** The real total across all pages. */
  recordsCount: number
}
